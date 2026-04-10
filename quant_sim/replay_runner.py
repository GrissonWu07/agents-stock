"""Background task runner for quant replay jobs."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Callable

from quant_sim.db import DEFAULT_DB_FILE, QuantSimDB


_RUNNER_INSTANCES: dict[str, "QuantSimReplayRunner"] = {}


class QuantSimReplayRunner:
    """Run replay jobs in daemon threads and support cooperative cancellation."""

    def __init__(self, db_file: str | Path = DEFAULT_DB_FILE):
        self.db_file = str(db_file)
        self.db = QuantSimDB(db_file)
        self._threads: dict[int, threading.Thread] = {}
        self._lock = threading.Lock()

    def start_run(self, run_id: int, target: Callable[[], None]) -> bool:
        with self._lock:
            existing = self._threads.get(run_id)
            if existing is not None and existing.is_alive():
                return False

            thread = threading.Thread(
                target=self._run_with_cleanup,
                args=(run_id, target),
                daemon=True,
                name=f"quant-replay-{run_id}",
            )
            self._threads[run_id] = thread
            thread.start()
            return True

    def cancel_run(self, run_id: int) -> bool:
        run = self.db.get_sim_run(run_id)
        if run is None:
            return False
        if str(run.get("status") or "") not in {"queued", "running"}:
            return False
        self.db.request_sim_run_cancel(run_id)
        self.db.append_sim_run_event(run_id, "已请求取消回放任务。", level="warning")
        return True

    def is_running(self, run_id: int) -> bool:
        with self._lock:
            thread = self._threads.get(run_id)
            return bool(thread and thread.is_alive())

    def _run_with_cleanup(self, run_id: int, target: Callable[[], None]) -> None:
        try:
            target()
        finally:
            with self._lock:
                thread = self._threads.get(run_id)
                if thread is not None and not thread.is_alive():
                    self._threads.pop(run_id, None)
                else:
                    self._threads.pop(run_id, None)


def get_quant_sim_replay_runner(db_file: str | Path = DEFAULT_DB_FILE) -> QuantSimReplayRunner:
    key = str(db_file)
    runner = _RUNNER_INSTANCES.get(key)
    if runner is None:
        runner = QuantSimReplayRunner(db_file=db_file)
        _RUNNER_INSTANCES[key] = runner
    return runner

