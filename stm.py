#!/usr/bin/env python3
"""
Simple Streamlit process manager.

This replaces an old shell snippet that had been accidentally saved as a
Python file, which broke repository-wide compile checks.
"""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

try:
    import psutil
except ImportError:  # pragma: no cover - optional runtime dependency
    psutil = None


APP_NAME = "app.py"
APP_PATH = Path(__file__).resolve().parent
PORT = 8501


def _streamlit_executable() -> str:
    venv_root = APP_PATH / "venv"
    windows_candidate = venv_root / "Scripts" / "streamlit.exe"
    unix_candidate = venv_root / "bin" / "streamlit"

    if windows_candidate.exists():
        return str(windows_candidate)
    if unix_candidate.exists():
        return str(unix_candidate)
    return "streamlit"


def _log_path() -> Path:
    return APP_PATH / "app.log"


def is_running() -> int | None:
    if psutil is None:
        return None

    for process in psutil.process_iter(["cmdline"]):
        cmdline = process.info.get("cmdline") or []
        joined = " ".join(cmdline)
        if "streamlit" in joined and "run" in cmdline and APP_NAME in joined:
            return process.pid
    return None


def start() -> None:
    if is_running():
        print("already running")
        return

    streamlit_cmd = _streamlit_executable()
    command = [
        streamlit_cmd,
        "run",
        APP_NAME,
        "--server.port",
        str(PORT),
        "--server.address",
        "0.0.0.0",
        "--server.headless",
        "true",
    ]

    os.chdir(APP_PATH)
    with _log_path().open("a", encoding="utf-8") as log_file:
        creationflags = 0
        popen_kwargs = {}
        if os.name == "nt":
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            popen_kwargs["preexec_fn"] = os.setsid

        subprocess.Popen(
            command,
            stdout=log_file,
            stderr=log_file,
            creationflags=creationflags,
            **popen_kwargs,
        )

    time.sleep(3)
    print(f"started on http://127.0.0.1:{PORT}")


def stop() -> None:
    pid = is_running()
    if not pid:
        print("not running")
        return

    if os.name == "nt":
        os.kill(pid, signal.SIGTERM)
    else:
        os.killpg(os.getpgid(pid), signal.SIGTERM)
    print("stopped")


def status() -> None:
    pid = is_running()
    if pid:
        print(f"running (pid={pid})")
    else:
        print("not running")


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"start", "stop", "status"}:
        print("usage: python stm.py [start|stop|status]")
        return 1

    action = sys.argv[1]
    if action == "start":
        start()
    elif action == "stop":
        stop()
    else:
        status()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
