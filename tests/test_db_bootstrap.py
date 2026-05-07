from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db.bootstrap import bootstrap_database_runtime
from app.gateway.context import UIApiContext
from app.gateway_api import create_app


def test_ui_api_context_uses_runtime_store_paths_by_default(tmp_path: Path):
    runtime = bootstrap_database_runtime({}, data_dir=tmp_path)

    context = UIApiContext(data_dir=tmp_path, logs_dir=tmp_path / "logs", db_runtime=runtime)

    assert context.quant_sim_db_file == runtime.primary_path
    assert context.quant_sim_replay_db_file == runtime.replay_path
    assert context.monitor_db_file == runtime.primary_path
    assert context.smart_monitor_db_file == runtime.primary_path
    assert context.stock_analysis_db_file == runtime.primary_path
    assert context.main_force_batch_db_file == runtime.primary_path


def test_create_app_exposes_bootstrapped_runtime_on_state(tmp_path: Path):
    runtime = bootstrap_database_runtime({}, data_dir=tmp_path)
    context = UIApiContext(data_dir=tmp_path, logs_dir=tmp_path / "logs", db_runtime=runtime)

    client = TestClient(create_app(context=context))

    assert client.app.state.ui_context.db_runtime is runtime


def test_create_app_default_context_uses_runtime_store_paths(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setenv("APP_DB_SQLITE_DIR", str(tmp_path))

    app = create_app()
    context = app.state.ui_context
    runtime = context.db_runtime

    assert runtime is not None
    assert context.quant_sim_db_file == runtime.primary_path
    assert context.quant_sim_replay_db_file == runtime.replay_path
    assert context.monitor_db_file == runtime.primary_path


def test_ui_api_context_accepts_mysql_runtime_for_runtime_managed_persistence(tmp_path: Path):
    runtime = bootstrap_database_runtime(
        {
            "APP_DB_BACKEND": "mysql",
            "APP_DB_MYSQL_HOST": "db.internal",
            "APP_DB_MYSQL_USER": "xuanwu",
            "APP_DB_MYSQL_PASSWORD": "secret",
        },
        data_dir=tmp_path,
    )

    context = UIApiContext(data_dir=tmp_path, logs_dir=tmp_path / "logs", db_runtime=runtime)

    assert context.db_runtime is runtime
    assert Path(context.quant_sim_db_file).name == "xuanwu_stock.db"
    assert Path(context.quant_sim_replay_db_file).name == "xuanwu_stock_replay.db"
