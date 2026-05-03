from __future__ import annotations

import json
from pathlib import Path

from app import version_info


def test_version_info_uses_packaged_version_file_when_git_is_unavailable(tmp_path, monkeypatch):
    payload = {
        "version": "0.1.0",
        "display": "0.1.0",
        "tag": "bundled",
        "revision": "bundled",
        "describe": "0.1.0",
        "dirty": False,
    }
    (tmp_path / "version.json").write_text(json.dumps(payload), encoding="utf-8")

    monkeypatch.delenv("APP_VERSION", raising=False)
    monkeypatch.delenv("APP_REVISION", raising=False)
    monkeypatch.delenv("APP_VERSION_TAG", raising=False)
    monkeypatch.delenv("GIT_DESCRIBE", raising=False)
    monkeypatch.delenv("GIT_REVISION", raising=False)
    monkeypatch.delenv("GIT_TAG", raising=False)
    monkeypatch.setattr(version_info, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(version_info, "_git_output", lambda *args: "")
    version_info.get_version_info.cache_clear()

    try:
        info = version_info.get_version_info()
    finally:
        version_info.get_version_info.cache_clear()

    assert info["display"] == "0.1.0"
    assert info["revision"] == "bundled"
    assert info["tag"] == "bundled"
    assert info["dirty"] is False


def test_version_info_prefers_environment_over_packaged_file(tmp_path, monkeypatch):
    (tmp_path / "version.json").write_text(
        json.dumps({"version": "0.1.0", "revision": "bundled"}),
        encoding="utf-8",
    )

    monkeypatch.setenv("APP_VERSION", "2026.05.03")
    monkeypatch.setenv("APP_REVISION", "abc1234")
    monkeypatch.setenv("APP_VERSION_TAG", "release")
    monkeypatch.setattr(version_info, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(version_info, "_git_output", lambda *args: "")
    version_info.get_version_info.cache_clear()

    try:
        info = version_info.get_version_info()
    finally:
        version_info.get_version_info.cache_clear()

    assert info["display"] == "2026.05.03"
    assert info["revision"] == "abc1234"
    assert info["tag"] == "release"


def test_version_info_prefers_git_over_packaged_file_display(tmp_path, monkeypatch):
    (tmp_path / "version.json").write_text(
        json.dumps({"version": "0.1.0", "display": "0.1.0", "revision": "bundled"}),
        encoding="utf-8",
    )

    monkeypatch.delenv("APP_VERSION", raising=False)
    monkeypatch.delenv("APP_VERSION_DISPLAY", raising=False)
    monkeypatch.delenv("APP_REVISION", raising=False)
    monkeypatch.delenv("APP_VERSION_TAG", raising=False)
    monkeypatch.delenv("GIT_DESCRIBE", raising=False)
    monkeypatch.delenv("GIT_REVISION", raising=False)
    monkeypatch.delenv("GIT_TAG", raising=False)
    monkeypatch.setattr(version_info, "PROJECT_ROOT", tmp_path)

    def fake_git(*args: str) -> str:
        if args == ("rev-parse", "--short", "HEAD"):
            return "def5678"
        if args == ("describe", "--tags", "--always", "--dirty"):
            return "def5678-dirty"
        return ""

    monkeypatch.setattr(version_info, "_git_output", fake_git)
    version_info.get_version_info.cache_clear()

    try:
        info = version_info.get_version_info()
    finally:
        version_info.get_version_info.cache_clear()

    assert info["display"] == "def5678-dirty"
    assert info["revision"] == "def5678"
    assert info["dirty"] is True


def test_write_version_file_persists_current_environment_version(tmp_path, monkeypatch):
    target = tmp_path / "version.json"

    monkeypatch.setenv("APP_VERSION", "sha-abc1234")
    monkeypatch.setenv("APP_VERSION_DISPLAY", "sha-abc1234")
    monkeypatch.setenv("APP_REVISION", "abc1234")
    monkeypatch.setenv("APP_VERSION_TAG", "main")
    monkeypatch.setattr(version_info, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(version_info, "_git_output", lambda *args: "")
    version_info.get_version_info.cache_clear()

    try:
        info = version_info.write_version_file(target)
    finally:
        version_info.get_version_info.cache_clear()

    persisted = json.loads(target.read_text(encoding="utf-8"))
    assert info["revision"] == "abc1234"
    assert persisted["display"] == "sha-abc1234"
    assert persisted["revision"] == "abc1234"
    assert persisted["tag"] == "main"
