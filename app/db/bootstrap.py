from __future__ import annotations

import os
from pathlib import Path
from typing import Mapping

from app.db.runtime.config import DatabaseRuntimeConfig
from app.db.runtime.registry import DatabaseRuntime, set_process_database_runtime
from app.runtime_paths import DATA_DIR


def bootstrap_database_runtime(
    env: Mapping[str, str] | None = None,
    *,
    data_dir: Path | None = None,
) -> DatabaseRuntime:
    config = DatabaseRuntimeConfig.from_env(env or os.environ, data_dir=data_dir or DATA_DIR)
    runtime = DatabaseRuntime(config=config)
    if runtime.primary_path is not None:
        runtime.primary_path.parent.mkdir(parents=True, exist_ok=True)
    if runtime.replay_path is not None:
        runtime.replay_path.parent.mkdir(parents=True, exist_ok=True)
    return set_process_database_runtime(runtime)
