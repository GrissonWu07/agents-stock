from pathlib import Path

import pytest
from sqlalchemy import text

from app.db.bootstrap import bootstrap_database_runtime
from app.db.runtime.config import DatabaseRuntimeConfig
from app.db.runtime.health import runtime_health_payload


def test_runtime_defaults_to_sqlite_urls(tmp_path: Path):
    config = DatabaseRuntimeConfig.from_env({}, data_dir=tmp_path)

    assert config.backend == "sqlite"
    assert config.primary_url == f"sqlite:///{tmp_path.joinpath('xuanwu_stock.db').as_posix()}"
    assert config.replay_url == f"sqlite:///{tmp_path.joinpath('xuanwu_stock_replay.db').as_posix()}"


def test_runtime_rejects_mixed_backend_overrides(tmp_path: Path):
    with pytest.raises(ValueError, match="mixed backend"):
        DatabaseRuntimeConfig.from_env(
            {
                "APP_DB_BACKEND": "sqlite",
                "APP_DB_PRIMARY_URL": "sqlite:///tmp/primary.db",
                "APP_DB_REPLAY_URL": "mysql+pymysql://user:pass@localhost:3306/replay",
            },
            data_dir=tmp_path,
        )


def test_runtime_builds_mysql_urls():
    config = DatabaseRuntimeConfig.from_env(
        {
            "APP_DB_BACKEND": "mysql",
            "APP_DB_MYSQL_HOST": "db.internal",
            "APP_DB_MYSQL_PORT": "3307",
            "APP_DB_MYSQL_USER": "xuanwu",
            "APP_DB_MYSQL_PASSWORD": "secret",
            "APP_DB_MYSQL_PRIMARY_DB": "xuanwu_stock",
            "APP_DB_MYSQL_REPLAY_DB": "xuanwu_stock_replay",
        }
    )

    assert config.backend == "mysql"
    assert config.primary_url == "mysql+pymysql://xuanwu:secret@db.internal:3307/xuanwu_stock?charset=utf8mb4"
    assert config.replay_url == "mysql+pymysql://xuanwu:secret@db.internal:3307/xuanwu_stock_replay?charset=utf8mb4"


def test_bootstrap_database_runtime_creates_sqlite_parent(tmp_path: Path):
    runtime = bootstrap_database_runtime({}, data_dir=tmp_path)

    assert runtime.config.backend == "sqlite"
    assert runtime.primary_path == tmp_path / "xuanwu_stock.db"
    assert runtime.replay_path == tmp_path / "xuanwu_stock_replay.db"
    assert runtime.primary_path.parent.exists()


def test_runtime_read_uow_uses_sqlite_query_only(tmp_path: Path):
    runtime = bootstrap_database_runtime({}, data_dir=tmp_path)

    with runtime.write_uow("primary") as uow:
        uow.session.execute(text("CREATE TABLE sample (id INTEGER PRIMARY KEY, name TEXT NOT NULL)"))
        uow.commit()

    with runtime.read_uow("primary") as uow:
        with pytest.raises(Exception, match="readonly|query only|read-only"):
            uow.session.execute(text("INSERT INTO sample (id, name) VALUES (1, 'blocked')"))


def test_runtime_health_payload_redacts_mysql_password():
    payload = runtime_health_payload(bootstrap_database_runtime(
        {
            "APP_DB_BACKEND": "mysql",
            "APP_DB_MYSQL_HOST": "db.internal",
            "APP_DB_MYSQL_PORT": "3307",
            "APP_DB_MYSQL_USER": "xuanwu",
            "APP_DB_MYSQL_PASSWORD": "secret",
        }
    ))

    assert payload["backend"] == "mysql"
    assert "secret" not in payload["stores"]["primary"]["url"]
    assert "***" in payload["stores"]["primary"]["url"]
    assert payload["stores"]["primary"]["poolStatus"]["readonly"] == "not-initialized"
    assert payload["migrationRevision"] == {"primary": None, "replay": None}


def test_app_code_no_longer_uses_direct_sqlite_connect():
    repo_root = Path(__file__).resolve().parents[1]
    offenders: list[str] = []
    for path in (repo_root / "app").rglob("*.py"):
        content = path.read_text(encoding="utf-8")
        if "sqlite3.connect(" in content:
            offenders.append(str(path.relative_to(repo_root)))
    assert offenders == []

