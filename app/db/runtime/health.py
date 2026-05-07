from __future__ import annotations

from typing import Any

from sqlalchemy.engine import make_url

from app.db.runtime.registry import DatabaseRuntime
from app.db.runtime.types import AccessMode, StoreName


def _redact_db_url(url: str) -> str:
    try:
        parsed = make_url(url)
    except Exception:
        return url
    if parsed.password is None:
        return parsed.render_as_string(hide_password=False)
    return parsed.render_as_string(hide_password=True)


def _pool_status(runtime: DatabaseRuntime, store: StoreName, access_mode: AccessMode) -> str:
    engine = runtime._engines.get((store, access_mode))  # noqa: SLF001 - runtime health needs existing pool state only
    if engine is None:
        return "not-initialized"
    status = getattr(engine.pool, "status", None)
    if callable(status):
        try:
            return str(status())
        except Exception:
            return "unavailable"
    return "unavailable"


def runtime_health_payload(runtime: DatabaseRuntime) -> dict[str, Any]:
    return {
        "backend": runtime.config.backend,
        "stores": {
            "primary": {
                "url": _redact_db_url(runtime.config.primary_url),
                "poolStatus": {
                    "readonly": _pool_status(runtime, "primary", "readonly"),
                    "readwrite": _pool_status(runtime, "primary", "readwrite"),
                    "worker_write": _pool_status(runtime, "primary", "worker_write"),
                },
            },
            "replay": {
                "url": _redact_db_url(runtime.config.replay_url),
                "poolStatus": {
                    "readonly": _pool_status(runtime, "replay", "readonly"),
                    "readwrite": _pool_status(runtime, "replay", "readwrite"),
                    "worker_write": _pool_status(runtime, "replay", "worker_write"),
                },
            },
        },
        "migrationRevision": {
            "primary": None,
            "replay": None,
        },
    }
