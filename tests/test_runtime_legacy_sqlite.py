from pathlib import Path

import pytest

from app.config_manager import ConfigManager
from app.data.analysis_context.repository import StockAnalysisContextRepository
from app.database import StockAnalysisDatabase
from app.db.bootstrap import bootstrap_database_runtime
from app.db.runtime.legacy_sqlite import resolve_legacy_sqlite_db_path
from app.main_force_batch_db import MainForceBatchDatabase
from app.monitor_db import StockMonitorDatabase
from app.smart_monitor_db import SmartMonitorDB
from app.ui_table_cache_db import UITableCacheDB


@pytest.mark.parametrize(
    ("factory", "expected_name"),
    [
        (lambda runtime, tmp_path: StockAnalysisDatabase(db_runtime=runtime), "xuanwu_stock.db"),
        (lambda runtime, tmp_path: SmartMonitorDB(db_runtime=runtime), "xuanwu_stock.db"),
        (lambda runtime, tmp_path: MainForceBatchDatabase(db_runtime=runtime), "xuanwu_stock.db"),
        (lambda runtime, tmp_path: UITableCacheDB(db_runtime=runtime), "xuanwu_stock.db"),
        (lambda runtime, tmp_path: StockAnalysisContextRepository(db_runtime=runtime), "xuanwu_stock.db"),
        (
            lambda runtime, tmp_path: ConfigManager(
                env_file=str(tmp_path / ".env.runtime"),
                db_runtime=runtime,
            ),
            "xuanwu_stock.db",
        ),
        (lambda runtime, tmp_path: StockMonitorDatabase(db_runtime=runtime), "xuanwu_stock.db"),
    ],
)
def test_legacy_sqlite_wrappers_resolve_runtime_primary_store(tmp_path: Path, factory, expected_name: str):
    runtime = bootstrap_database_runtime({}, data_dir=tmp_path)

    wrapper = factory(runtime, tmp_path)
    raw_path = getattr(wrapper, "db_path", None)
    if raw_path is None:
        raw_path = getattr(wrapper, "db_file")
    db_path = Path(raw_path)

    assert db_path == runtime.primary_path
    assert db_path.name == expected_name


def test_resolve_legacy_sqlite_db_path_allows_mysql_runtime(tmp_path: Path):
    runtime = bootstrap_database_runtime(
        {
            "APP_DB_BACKEND": "mysql",
            "APP_DB_MYSQL_HOST": "db.internal",
            "APP_DB_MYSQL_USER": "xuanwu",
            "APP_DB_MYSQL_PASSWORD": "secret",
        },
        data_dir=tmp_path,
    )

    resolved = resolve_legacy_sqlite_db_path(
        db_path=None,
        db_runtime=runtime,
        store="primary",
        fallback=tmp_path / "xuanwu_stock.db",
    )

    assert Path(resolved).name == "xuanwu_stock.db"

