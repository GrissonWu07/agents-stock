from __future__ import annotations

from pathlib import Path

from app.db.runtime.registry import DatabaseRuntime, get_process_database_runtime
from app.db.runtime.types import StoreName


def resolve_legacy_sqlite_db_path(
    *,
    db_path: str | Path | None,
    db_runtime: DatabaseRuntime | None,
    store: StoreName,
    fallback: str | Path,
) -> str:
    runtime = db_runtime or get_process_database_runtime()
    if db_path is not None:
        return str(db_path)
    if runtime.config.backend != "sqlite":
        return str(fallback)
    resolved = runtime.primary_path if store == "primary" else runtime.replay_path
    if resolved is None:
        raise ValueError(f"Runtime store '{store}' is not backed by a local sqlite file.")
    return str(resolved)
