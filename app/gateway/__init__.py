from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def __getattr__(name: str) -> Any:
    if name == "UIApiContext":
        from app.gateway.context import UIApiContext

        return UIApiContext
    if name == "create_app":
        from app.gateway_api import create_app

        return create_app
    if name == "main":
        return main
    raise AttributeError(name)


def main() -> None:
    try:
        import uvicorn
    except ImportError as exc:  # pragma: no cover - runtime convenience only
        raise RuntimeError("uvicorn is required to run the backend API") from exc

    from app.gateway_api import create_app

    uvicorn.run(
        create_app(),
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8501")),
        log_level=os.getenv("LOG_LEVEL", "info"),
    )


__all__ = ["UIApiContext", "create_app", "main"]
