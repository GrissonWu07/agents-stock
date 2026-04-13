from pathlib import Path

from app import database, watchlist_db
from app.quant_sim import db as quant_db
from app.runtime_paths import default_log_path, managed_db_path, migrate_known_root_logs


def test_managed_db_path_uses_data_directory(tmp_path):
    path = managed_db_path(
        "watchlist.db",
        project_root=tmp_path,
        data_dir=tmp_path / "data",
    )

    assert path == tmp_path / "data" / "watchlist.db"


def test_managed_db_path_moves_legacy_root_db_into_data(tmp_path):
    legacy_db = tmp_path / "watchlist.db"
    legacy_db.write_text("legacy", encoding="utf-8")

    path = managed_db_path(
        "watchlist.db",
        project_root=tmp_path,
        data_dir=tmp_path / "data",
    )

    assert path.exists()
    assert path.read_text(encoding="utf-8") == "legacy"
    assert not legacy_db.exists()


def test_managed_db_path_replaces_existing_data_db_with_backup(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    existing_db = data_dir / "watchlist.db"
    existing_db.write_text("existing", encoding="utf-8")
    legacy_db = tmp_path / "watchlist.db"
    legacy_db.write_text("legacy", encoding="utf-8")

    path = managed_db_path(
        "watchlist.db",
        project_root=tmp_path,
        data_dir=data_dir,
    )

    backups = list(data_dir.glob("watchlist.db.bak-*"))
    assert path.read_text(encoding="utf-8") == "legacy"
    assert len(backups) == 1
    assert backups[0].read_text(encoding="utf-8") == "existing"


def test_default_runtime_db_constants_point_into_data_dir():
    assert Path(database.DEFAULT_DB_PATH).parent.name == "data"
    assert Path(watchlist_db.DEFAULT_DB_FILE).parent.name == "data"
    assert Path(quant_db.DEFAULT_DB_FILE).parent.name == "data"


def test_default_log_path_uses_logs_directory(tmp_path):
    path = default_log_path("app.log", logs_dir=tmp_path / "logs")
    assert path == tmp_path / "logs" / "app.log"


def test_migrate_known_root_logs_moves_root_logs_into_logs_dir(tmp_path):
    root_log = tmp_path / "app.log"
    root_err = tmp_path / "app.err.log"
    root_log.write_text("stdout", encoding="utf-8")
    root_err.write_text("stderr", encoding="utf-8")

    migrated = migrate_known_root_logs(project_root=tmp_path, logs_dir=tmp_path / "logs")

    assert tmp_path.joinpath("logs", "app.log").read_text(encoding="utf-8") == "stdout"
    assert tmp_path.joinpath("logs", "app.err.log").read_text(encoding="utf-8") == "stderr"
    assert not root_log.exists()
    assert not root_err.exists()
    assert len(migrated) == 2
