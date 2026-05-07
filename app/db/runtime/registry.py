from __future__ import annotations

from dataclasses import dataclass, field
import os
from pathlib import Path
from threading import Lock

from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.db.runtime.config import DatabaseRuntimeConfig
from app.db.runtime.engine_factory import create_store_engine
from app.db.runtime.session import build_session_factory
from app.db.runtime.types import AccessMode, StoreName
from app.db.runtime.uow import session_uow
from app.runtime_paths import DATA_DIR


_PROCESS_RUNTIME: "DatabaseRuntime | None" = None
_PROCESS_RUNTIME_LOCK = Lock()


@dataclass
class DatabaseRuntime:
    config: DatabaseRuntimeConfig
    _engines: dict[tuple[StoreName, AccessMode], Engine] = field(default_factory=dict)
    _session_factories: dict[tuple[StoreName, AccessMode], sessionmaker] = field(default_factory=dict)

    @property
    def primary_path(self) -> Path | None:
        return _sqlite_path_from_url(self.config.primary_url)

    @property
    def replay_path(self) -> Path | None:
        return _sqlite_path_from_url(self.config.replay_url)

    def engine(self, store: StoreName, access_mode: AccessMode = "readwrite") -> Engine:
        key = (store, access_mode)
        engine = self._engines.get(key)
        if engine is None:
            engine = create_store_engine(self.config, store=store, access_mode=access_mode)
            self._engines[key] = engine
        return engine

    def session_factory(self, store: StoreName, access_mode: AccessMode = "readwrite"):
        key = (store, access_mode)
        factory = self._session_factories.get(key)
        if factory is None:
            factory = build_session_factory(bind=self.engine(store, access_mode=access_mode))
            self._session_factories[key] = factory
        return factory

    def read_uow(self, store: StoreName):
        return session_uow(self.session_factory(store, access_mode="readonly"), readonly=True)

    def write_uow(self, store: StoreName):
        return session_uow(self.session_factory(store, access_mode="readwrite"), readonly=False)

    def worker_uow(self, store: StoreName):
        return session_uow(self.session_factory(store, access_mode="worker_write"), readonly=False)


def get_process_database_runtime(
    *,
    env: dict[str, str] | None = None,
    data_dir: Path | None = None,
) -> DatabaseRuntime:
    global _PROCESS_RUNTIME
    with _PROCESS_RUNTIME_LOCK:
        if _PROCESS_RUNTIME is None:
            config = DatabaseRuntimeConfig.from_env(env or os.environ, data_dir=data_dir or DATA_DIR)
            runtime = DatabaseRuntime(config=config)
            if runtime.primary_path is not None:
                runtime.primary_path.parent.mkdir(parents=True, exist_ok=True)
            if runtime.replay_path is not None:
                runtime.replay_path.parent.mkdir(parents=True, exist_ok=True)
            _PROCESS_RUNTIME = runtime
        return _PROCESS_RUNTIME


def set_process_database_runtime(runtime: DatabaseRuntime) -> DatabaseRuntime:
    global _PROCESS_RUNTIME
    with _PROCESS_RUNTIME_LOCK:
        _PROCESS_RUNTIME = runtime
    return runtime


def clear_process_database_runtime() -> None:
    global _PROCESS_RUNTIME
    with _PROCESS_RUNTIME_LOCK:
        _PROCESS_RUNTIME = None


def _sqlite_path_from_url(url: str) -> Path | None:
    prefix = "sqlite:///"
    if not str(url).startswith(prefix):
        return None
    return Path(str(url)[len(prefix):])
