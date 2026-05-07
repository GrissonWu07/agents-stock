from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
import re
import sqlite3
from pathlib import Path
from threading import Lock
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DBAPIError, IntegrityError as SAIntegrityError, OperationalError as SAOperationalError

from app.db.runtime.registry import DatabaseRuntime, get_process_database_runtime
from app.db.runtime.types import AccessMode, StoreName
from app.runtime_paths import default_db_path


_EXPLICIT_SQLITE_ENGINES: dict[tuple[str, AccessMode], Engine] = {}
_EXPLICIT_SQLITE_ENGINES_LOCK = Lock()
_PRAGMA_TABLE_INFO_RE = re.compile(r"^\s*PRAGMA\s+table_info\(\s*['\"`]?([^'\"`)]+)['\"`]?\s*\)\s*;?\s*$", re.IGNORECASE)
_NOOP_MYSQL_PRAGMAS = {"foreign_keys", "busy_timeout", "query_only", "journal_mode", "synchronous"}


class _CompatRow(Mapping[str, Any]):
    def __init__(self, keys: Sequence[str], values: Sequence[Any]) -> None:
        self._keys = tuple(str(key) for key in keys)
        self._values = tuple(values)
        self._mapping = dict(zip(self._keys, self._values, strict=False))

    def __getitem__(self, key: str | int) -> Any:
        if isinstance(key, int):
            return self._values[key]
        return self._mapping[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._keys)

    def __len__(self) -> int:
        return len(self._keys)

    def keys(self):
        return list(self._keys)


class _PooledDBAPIConnectionProxy:
    def __init__(self, pooled_connection, driver_connection) -> None:
        object.__setattr__(self, "_pooled_connection", pooled_connection)
        object.__setattr__(self, "_driver_connection", driver_connection)

    def __getattr__(self, name: str):
        return getattr(self._driver_connection, name)

    def __setattr__(self, name: str, value) -> None:
        if name in {"_pooled_connection", "_driver_connection"}:
            object.__setattr__(self, name, value)
            return
        setattr(self._driver_connection, name, value)

    def close(self) -> None:
        self._pooled_connection.close()

    def __enter__(self):
        enter = getattr(self._driver_connection, "__enter__", None)
        if callable(enter):
            enter()
        return self

    def __exit__(self, exc_type, exc, tb):
        exit_method = getattr(self._driver_connection, "__exit__", None)
        suppress = bool(exit_method(exc_type, exc, tb)) if callable(exit_method) else False
        self.close()
        return suppress


class _MySQLCompatCursorProxy:
    def __init__(self, connection_proxy: "_MySQLCompatConnectionProxy", driver_cursor) -> None:
        self._connection_proxy = connection_proxy
        self._driver_cursor = driver_cursor
        self.description = None
        self.rowcount = -1
        self.lastrowid = None

    def execute(self, statement: str, parameters: Sequence[Any] | None = None):
        sql = str(statement or "")
        if _is_mysql_noop_pragma(sql):
            self.description = None
            self.rowcount = -1
            self.lastrowid = None
            return self
        translated_sql, translated_params = translate_legacy_sqlite_sql_for_mysql(sql, parameters)
        try:
            self._driver_cursor.execute(translated_sql, translated_params)
        except Exception as exc:
            raise _recast_mysql_exception(exc) from exc
        self.description = getattr(self._driver_cursor, "description", None)
        self.rowcount = getattr(self._driver_cursor, "rowcount", -1)
        self.lastrowid = getattr(self._driver_cursor, "lastrowid", None)
        return self

    def executemany(self, statement: str, seq_of_parameters: Sequence[Sequence[Any]]):
        sql = str(statement or "")
        if _is_mysql_noop_pragma(sql):
            self.description = None
            self.rowcount = -1
            self.lastrowid = None
            return self
        translated_sql, _ = translate_legacy_sqlite_sql_for_mysql(sql, ())
        normalized_params = [tuple(parameters or ()) for parameters in seq_of_parameters]
        try:
            self._driver_cursor.executemany(translated_sql, normalized_params)
        except Exception as exc:
            raise _recast_mysql_exception(exc) from exc
        self.description = getattr(self._driver_cursor, "description", None)
        self.rowcount = getattr(self._driver_cursor, "rowcount", -1)
        self.lastrowid = getattr(self._driver_cursor, "lastrowid", None)
        return self

    def fetchone(self):
        row = self._driver_cursor.fetchone()
        return self._adapt_row(row)

    def fetchall(self):
        return [self._adapt_row(row) for row in self._driver_cursor.fetchall()]

    def close(self) -> None:
        try:
            self._driver_cursor.close()
        except Exception:
            return None

    def _adapt_row(self, row):
        if row is None:
            return None
        row_factory = getattr(self._connection_proxy, "row_factory", None)
        if row_factory is sqlite3.Row and self.description:
            keys = [str(item[0]) for item in self.description]
            return _CompatRow(keys, row)
        return row


class _MySQLCompatConnectionProxy:
    def __init__(self, pooled_connection, driver_connection, *, row_factory: bool = False) -> None:
        object.__setattr__(self, "_pooled_connection", pooled_connection)
        object.__setattr__(self, "_driver_connection", driver_connection)
        object.__setattr__(self, "row_factory", sqlite3.Row if row_factory else None)

    def __getattr__(self, name: str):
        return getattr(self._driver_connection, name)

    def __setattr__(self, name: str, value) -> None:
        if name in {"_pooled_connection", "_driver_connection", "row_factory"}:
            object.__setattr__(self, name, value)
            return
        setattr(self._driver_connection, name, value)

    def cursor(self):
        return _MySQLCompatCursorProxy(self, self._driver_connection.cursor())

    def execute(self, statement: str, parameters: Sequence[Any] | None = None):
        cursor = self.cursor()
        cursor.execute(statement, parameters)
        return cursor

    def executemany(self, statement: str, seq_of_parameters: Sequence[Sequence[Any]]):
        cursor = self.cursor()
        cursor.executemany(statement, seq_of_parameters)
        return cursor

    def commit(self) -> None:
        try:
            self._driver_connection.commit()
        except Exception as exc:
            raise _recast_mysql_exception(exc) from exc

    def rollback(self) -> None:
        try:
            self._driver_connection.rollback()
        except Exception as exc:
            raise _recast_mysql_exception(exc) from exc

    def close(self) -> None:
        self._pooled_connection.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is None:
                self.commit()
            else:
                self.rollback()
        finally:
            self.close()
        return False


def _create_sqlite_engine_for_path(db_path: Path, *, access_mode: AccessMode) -> Engine:
    engine = create_engine(
        f"sqlite:///{db_path.as_posix()}",
        future=True,
        connect_args={"timeout": 30.0},
    )

    @event.listens_for(engine, "connect")
    def _configure_sqlite_connection(dbapi_connection, _connection_record):  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA busy_timeout = 30000")
        if access_mode == "readonly":
            cursor.execute("PRAGMA query_only = ON")
        else:
            cursor.execute("PRAGMA journal_mode = WAL")
            cursor.execute("PRAGMA synchronous = NORMAL")
        cursor.close()

    return engine


def explicit_sqlite_engine(db_path: str | Path, *, access_mode: AccessMode = "readwrite") -> Engine:
    resolved = Path(db_path).resolve()
    resolved.parent.mkdir(parents=True, exist_ok=True)
    key = (str(resolved), access_mode)
    with _EXPLICIT_SQLITE_ENGINES_LOCK:
        engine = _EXPLICIT_SQLITE_ENGINES.get(key)
        if engine is None:
            engine = _create_sqlite_engine_for_path(resolved, access_mode=access_mode)
            _EXPLICIT_SQLITE_ENGINES[key] = engine
    return engine


def _is_mysql_noop_pragma(statement: str) -> bool:
    match = re.match(r"^\s*PRAGMA\s+([A-Za-z_][\w]*)", statement or "", re.IGNORECASE)
    if not match:
        return False
    return match.group(1).lower() in _NOOP_MYSQL_PRAGMAS


def _translate_datetime_sql_for_mysql(statement: str) -> str:
    translated = str(statement)
    translated = re.sub(
        r"datetime\(\s*'now'\s*,\s*'-'\s*\|\|\s*\?\s*\|\|\s*'\s*minutes'\s*\)",
        "DATE_SUB(NOW(), INTERVAL ? MINUTE)",
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(
        r"datetime\(\s*'now'\s*,\s*'-'\s*\|\|\s*\?\s*\|\|\s*'\s*days'\s*\)",
        "DATE_SUB(NOW(), INTERVAL ? DAY)",
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(
        r"datetime\(\s*COALESCE\(\s*valid_until\s*,\s*datetime\(\s*COALESCE\(\s*data_as_of\s*,\s*created_at\s*,\s*analysis_date\s*\)\s*,\s*'\+48 hours'\s*\)\s*\)\s*\)",
        "COALESCE(valid_until, DATE_ADD(COALESCE(data_as_of, created_at, analysis_date), INTERVAL 48 HOUR))",
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(
        r"datetime\(\s*COALESCE\(\s*NULLIF\(\s*fetch_time\s*,\s*''\s*\)\s*,\s*created_at\s*\)\s*\)",
        "COALESCE(NULLIF(fetch_time, ''), created_at)",
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(
        r"datetime\(\s*COALESCE\(\s*data_as_of\s*,\s*created_at\s*,\s*analysis_date\s*\)\s*\)",
        "COALESCE(data_as_of, created_at, analysis_date)",
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(
        r"datetime\(\s*COALESCE\(\s*created_at\s*,\s*analysis_date\s*\)\s*\)",
        "COALESCE(created_at, analysis_date)",
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(r"datetime\(\s*([A-Za-z_][\w]*)\s*\)", r"\1", translated, flags=re.IGNORECASE)
    translated = re.sub(r"datetime\(\s*\?\s*\)", "?", translated, flags=re.IGNORECASE)
    translated = re.sub(r"date\(\s*([^)]+?)\s*\)", r"DATE(\1)", translated, flags=re.IGNORECASE)
    return translated


def _translate_create_table_sql_for_mysql(statement: str) -> str:
    translated = str(statement)
    translated = re.sub(r"\bAUTOINCREMENT\b", "AUTO_INCREMENT", translated, flags=re.IGNORECASE)
    translated = re.sub(
        r"(\b[A-Za-z_][\w]*\b)\s+TEXT\s+DEFAULT\s+\(strftime\([^)]*\)\)",
        r"\1 DATETIME DEFAULT CURRENT_TIMESTAMP",
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(
        r"(\b[A-Za-z_][\w]*\b)\s+TEXT\s+DEFAULT\s+CURRENT_TIMESTAMP",
        r"\1 DATETIME DEFAULT CURRENT_TIMESTAMP",
        translated,
        flags=re.IGNORECASE,
    )
    return translated


def _convert_qmark_placeholders(statement: str) -> str:
    parts: list[str] = []
    in_single = False
    in_double = False
    escape = False
    for char in statement:
        if escape:
            parts.append(char)
            escape = False
            continue
        if char == "\\":
            parts.append(char)
            escape = True
            continue
        if char == "'" and not in_double:
            in_single = not in_single
            parts.append(char)
            continue
        if char == '"' and not in_single:
            in_double = not in_double
            parts.append(char)
            continue
        if char == "?" and not in_single and not in_double:
            parts.append("%s")
            continue
        parts.append(char)
    return "".join(parts)


def translate_legacy_sqlite_sql_for_mysql(
    statement: str,
    parameters: Sequence[Any] | None = None,
) -> tuple[str, tuple[Any, ...]]:
    sql = str(statement or "")
    params = tuple(parameters or ())

    pragma_match = _PRAGMA_TABLE_INFO_RE.match(sql)
    if pragma_match:
        table_name = pragma_match.group(1).strip()
        return (
            """
            SELECT
                ORDINAL_POSITION - 1 AS cid,
                COLUMN_NAME AS name,
                COLUMN_TYPE AS type,
                CASE WHEN IS_NULLABLE = 'NO' THEN 1 ELSE 0 END AS notnull,
                COLUMN_DEFAULT AS dflt_value,
                CASE WHEN COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END AS pk
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = %s
            ORDER BY ORDINAL_POSITION
            """,
            (table_name,),
        )

    translated = _translate_datetime_sql_for_mysql(sql)
    translated = re.sub(r"\bINSERT\s+OR\s+REPLACE\b", "REPLACE", translated, flags=re.IGNORECASE)
    translated = re.sub(r"\bINSERT\s+OR\s+IGNORE\b", "INSERT IGNORE", translated, flags=re.IGNORECASE)
    translated = re.sub(
        r"\bON\s+CONFLICT\s*\(([^)]+)\)\s*DO\s+UPDATE\s+SET\b",
        "ON DUPLICATE KEY UPDATE",
        translated,
        flags=re.IGNORECASE,
    )
    translated = re.sub(r"\bexcluded\.([A-Za-z_][\w]*)\b", r"VALUES(\1)", translated, flags=re.IGNORECASE)
    translated = _translate_create_table_sql_for_mysql(translated)
    translated = _convert_qmark_placeholders(translated)
    return translated, params


def _recast_mysql_exception(exc: BaseException) -> BaseException:
    message = str(exc)
    lowered = message.lower()
    if "duplicate column" in lowered:
        return sqlite3.OperationalError(message)
    if isinstance(exc, SAIntegrityError) or "duplicate entry" in lowered or "unique constraint" in lowered:
        return sqlite3.IntegrityError(message)
    if isinstance(exc, (SAOperationalError, DBAPIError)):
        return sqlite3.OperationalError(message)
    return sqlite3.OperationalError(message)


def _uses_process_managed_store(
    db_path: str | Path,
    *,
    runtime: DatabaseRuntime,
    store: StoreName,
) -> bool:
    resolved = Path(db_path).expanduser().resolve()
    managed_targets: set[Path] = set()
    runtime_target = runtime.primary_path if store == "primary" else runtime.replay_path
    if runtime_target is not None:
        managed_targets.add(runtime_target.expanduser().resolve())
    managed_filename = "xuanwu_stock.db" if store == "primary" else "xuanwu_stock_replay.db"
    managed_targets.add(default_db_path(managed_filename).expanduser().resolve())
    return resolved in managed_targets


def legacy_dbapi_connection(
    *,
    db_path: str | Path,
    db_runtime: DatabaseRuntime | None = None,
    store: StoreName = "primary",
    access_mode: AccessMode = "readwrite",
    row_factory: bool = False,
    busy_timeout_ms: int | None = None,
):
    runtime = db_runtime
    if runtime is None:
        process_runtime = get_process_database_runtime()
        if _uses_process_managed_store(db_path, runtime=process_runtime, store=store):
            runtime = process_runtime
    if runtime is not None and runtime.config.backend == "mysql":
        engine = runtime.engine(store, access_mode=access_mode)
    elif runtime is not None and runtime.config.backend == "sqlite":
        expected_path = runtime.primary_path if store == "primary" else runtime.replay_path
        if expected_path is not None and Path(db_path).resolve() == expected_path.resolve():
            engine = runtime.engine(store, access_mode=access_mode)
        else:
            engine = explicit_sqlite_engine(db_path, access_mode=access_mode)
    else:
        engine = explicit_sqlite_engine(db_path, access_mode=access_mode)

    connection = engine.raw_connection()
    driver_connection = getattr(connection, "driver_connection", connection)
    if engine.dialect.name == "sqlite":
        if row_factory:
            connection.row_factory = sqlite3.Row
            driver_connection.row_factory = sqlite3.Row
        if busy_timeout_ms is not None:
            cursor = driver_connection.cursor()
            cursor.execute(f"PRAGMA busy_timeout = {max(int(busy_timeout_ms), 0)}")
            cursor.close()
        return _PooledDBAPIConnectionProxy(connection, driver_connection)
    return _MySQLCompatConnectionProxy(connection, driver_connection, row_factory=row_factory)
