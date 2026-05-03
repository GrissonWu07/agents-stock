from __future__ import annotations

import json
import os
import subprocess
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE_NAME = "version.json"


def _git_output(*args: str) -> str:
    try:
        completed = subprocess.run(
            ["git", "-C", str(PROJECT_ROOT), *args],
            check=True,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except Exception:
        return ""
    return completed.stdout.strip()


def _version_file_payload() -> dict[str, Any]:
    configured = os.getenv("APP_VERSION_FILE")
    path = Path(configured) if configured else PROJECT_ROOT / VERSION_FILE_NAME
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def write_version_file(path: str | Path | None = None) -> dict[str, Any]:
    get_version_info.cache_clear()
    payload = get_version_info()
    target = Path(path) if path else PROJECT_ROOT / VERSION_FILE_NAME
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    get_version_info.cache_clear()
    return payload


@lru_cache(maxsize=1)
def get_version_info() -> dict[str, Any]:
    version_file = _version_file_payload()
    revision = os.getenv("APP_REVISION") or os.getenv("GIT_REVISION") or _git_output("rev-parse", "--short", "HEAD")
    tag = os.getenv("APP_VERSION_TAG") or os.getenv("GIT_TAG") or _git_output("describe", "--tags", "--abbrev=0")
    describe = os.getenv("APP_VERSION") or os.getenv("GIT_DESCRIBE") or _git_output("describe", "--tags", "--always", "--dirty")
    display = os.getenv("APP_VERSION_DISPLAY")
    used_packaged_version = not describe

    revision = revision or version_file.get("revision")
    tag = tag or version_file.get("tag")
    describe = describe or version_file.get("describe") or version_file.get("version")
    display = display or (version_file.get("display") if used_packaged_version else None)
    dirty = describe.endswith("-dirty") if describe else False
    if used_packaged_version and "dirty" in version_file:
        dirty = bool(version_file.get("dirty"))

    revision = revision or "unknown"
    tag = tag or "unknown"
    describe = describe or revision
    display = display or (describe if describe != "unknown" else revision)

    return {
        "version": str(display),
        "display": str(display),
        "tag": str(tag),
        "revision": str(revision),
        "describe": str(describe),
        "dirty": dirty,
    }


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if not args or args == ["--print"]:
        print(json.dumps(get_version_info(), ensure_ascii=False, sort_keys=True))
        return 0
    if args[0] == "--write":
        target = args[1] if len(args) > 1 else None
        print(json.dumps(write_version_file(target), ensure_ascii=False, sort_keys=True))
        return 0
    raise SystemExit(f"unknown version_info command: {' '.join(args)}")


if __name__ == "__main__":
    raise SystemExit(main())
