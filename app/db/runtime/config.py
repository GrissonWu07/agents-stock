from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping
from urllib.parse import quote_plus

from app.db.runtime.types import BackendName
from app.runtime_paths import DATA_DIR


def _backend_for_url(url: str) -> str:
    lowered = str(url or "").lower()
    if lowered.startswith("sqlite:"):
        return "sqlite"
    if lowered.startswith("mysql+"):
        return "mysql"
    return "unknown"


@dataclass(frozen=True)
class DatabaseRuntimeConfig:
    backend: BackendName
    primary_url: str
    replay_url: str
    pool_size: int = 5
    max_overflow: int = 10
    pool_timeout_seconds: int = 30
    pool_recycle_seconds: int = 1800
    sqlite_busy_timeout_ms: int = 30000
    echo_sql: bool = False

    @classmethod
    def from_env(
        cls,
        env: Mapping[str, str] | None = None,
        *,
        data_dir: Path | None = None,
    ) -> "DatabaseRuntimeConfig":
        source = env or {}
        backend = str(source.get("APP_DB_BACKEND") or "sqlite").strip().lower()
        if backend not in {"sqlite", "mysql"}:
            raise ValueError(f"Unsupported APP_DB_BACKEND: {backend}")

        primary_override = str(source.get("APP_DB_PRIMARY_URL") or "").strip()
        replay_override = str(source.get("APP_DB_REPLAY_URL") or "").strip()
        if primary_override or replay_override:
            if not primary_override or not replay_override:
                raise ValueError("Both APP_DB_PRIMARY_URL and APP_DB_REPLAY_URL must be set together.")
            primary_backend = _backend_for_url(primary_override)
            replay_backend = _backend_for_url(replay_override)
            if primary_backend != replay_backend or primary_backend != backend:
                raise ValueError("Invalid mixed backend configuration for primary/replay URLs.")
            primary_url = primary_override
            replay_url = replay_override
        elif backend == "sqlite":
            target_dir = Path(source.get("APP_DB_SQLITE_DIR") or data_dir or DATA_DIR)
            target_dir.mkdir(parents=True, exist_ok=True)
            primary_url = f"sqlite:///{target_dir.joinpath('xuanwu_stock.db').as_posix()}"
            replay_url = f"sqlite:///{target_dir.joinpath('xuanwu_stock_replay.db').as_posix()}"
        else:
            host = str(source.get("APP_DB_MYSQL_HOST") or "127.0.0.1").strip()
            port = int(str(source.get("APP_DB_MYSQL_PORT") or "3306").strip())
            user = str(source.get("APP_DB_MYSQL_USER") or "").strip()
            password = str(source.get("APP_DB_MYSQL_PASSWORD") or "").strip()
            primary_db = str(source.get("APP_DB_MYSQL_PRIMARY_DB") or "xuanwu_stock").strip()
            replay_db = str(source.get("APP_DB_MYSQL_REPLAY_DB") or "xuanwu_stock_replay").strip()
            if not user:
                raise ValueError("APP_DB_MYSQL_USER is required when APP_DB_BACKEND=mysql.")
            encoded_password = quote_plus(password)
            primary_url = f"mysql+pymysql://{user}:{encoded_password}@{host}:{port}/{primary_db}?charset=utf8mb4"
            replay_url = f"mysql+pymysql://{user}:{encoded_password}@{host}:{port}/{replay_db}?charset=utf8mb4"

        return cls(
            backend=backend,  # type: ignore[arg-type]
            primary_url=primary_url,
            replay_url=replay_url,
            pool_size=int(str(source.get("APP_DB_POOL_SIZE") or "5").strip()),
            max_overflow=int(str(source.get("APP_DB_MAX_OVERFLOW") or "10").strip()),
            pool_timeout_seconds=int(str(source.get("APP_DB_POOL_TIMEOUT_SECONDS") or "30").strip()),
            pool_recycle_seconds=int(str(source.get("APP_DB_POOL_RECYCLE_SECONDS") or "1800").strip()),
            sqlite_busy_timeout_ms=int(str(source.get("APP_DB_SQLITE_BUSY_TIMEOUT_MS") or "30000").strip()),
            echo_sql=str(source.get("APP_DB_ECHO_SQL") or "").strip().lower() in {"1", "true", "yes", "on"},
        )

