from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool

from app.db.runtime.config import DatabaseRuntimeConfig
from app.db.runtime.types import AccessMode, StoreName


def create_store_engine(
    config: DatabaseRuntimeConfig,
    *,
    store: StoreName,
    access_mode: AccessMode,
) -> Engine:
    url = config.primary_url if store == "primary" else config.replay_url
    if config.backend == "sqlite":
        engine = create_engine(
            url,
            future=True,
            echo=config.echo_sql,
            connect_args={"timeout": max(config.sqlite_busy_timeout_ms / 1000.0, 0.0)},
        )

        @event.listens_for(engine, "connect")
        def _configure_sqlite_connection(dbapi_connection, _connection_record):  # type: ignore[no-untyped-def]
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys = ON")
            cursor.execute(f"PRAGMA busy_timeout = {max(config.sqlite_busy_timeout_ms, 0)}")
            if access_mode == "readonly":
                cursor.execute("PRAGMA query_only = ON")
            else:
                cursor.execute("PRAGMA journal_mode = WAL")
                cursor.execute("PRAGMA synchronous = NORMAL")
            cursor.close()

        return engine
    return create_engine(
        url,
        future=True,
        echo=config.echo_sql,
        poolclass=QueuePool,
        pool_size=max(config.pool_size, 1),
        max_overflow=max(config.max_overflow, 0),
        pool_timeout=max(config.pool_timeout_seconds, 1),
        pool_recycle=max(config.pool_recycle_seconds, 1),
        pool_pre_ping=True,
        isolation_level="READ COMMITTED",
    )
