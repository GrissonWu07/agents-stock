from __future__ import annotations

import filecmp
import shutil
from datetime import datetime
from pathlib import Path
from typing import Iterable


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
LOGS_DIR = PROJECT_ROOT / "logs"

KNOWN_DB_FILENAMES = (
    "longhubang.db",
    "low_price_bull_monitor.db",
    "main_force_batch.db",
    "news_flow.db",
    "profit_growth_monitor.db",
    "quant_sim.db",
    "sector_strategy.db",
    "smart_monitor.db",
    "stock_analysis.db",
    "stock_monitor.db",
    "watchlist_perf.db",
    "xuanwu_stock.db",
    "xuanwu_stock_replay.db",
)

KNOWN_LOG_FILENAMES = (
    "app.log",
    "app.err.log",
)


def default_db_path(filename: str, *, data_dir: Path | None = None) -> Path:
    target_dir = Path(data_dir) if data_dir is not None else DATA_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir / filename


def default_log_path(filename: str, *, logs_dir: Path | None = None) -> Path:
    target_dir = Path(logs_dir) if logs_dir is not None else LOGS_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir / filename


def managed_db_path(
    filename: str,
    *,
    project_root: Path | None = None,
    data_dir: Path | None = None,
) -> Path:
    root_dir = Path(project_root) if project_root is not None else PROJECT_ROOT
    target_dir = Path(data_dir) if data_dir is not None else DATA_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    source = root_dir / filename
    target = target_dir / filename
    if not source.exists():
        return target

    if target.exists():
        if filecmp.cmp(str(source), str(target), shallow=False):
            source.unlink()
            return target

        backup = target_dir / f"{filename}.bak-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        shutil.move(str(target), str(backup))

    shutil.move(str(source), str(target))
    return target


def managed_log_path(
    filename: str,
    *,
    project_root: Path | None = None,
    logs_dir: Path | None = None,
) -> Path:
    root_dir = Path(project_root) if project_root is not None else PROJECT_ROOT
    target_dir = Path(logs_dir) if logs_dir is not None else LOGS_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    source = root_dir / filename
    target = target_dir / filename
    if not source.exists():
        return target

    if target.exists():
        if filecmp.cmp(str(source), str(target), shallow=False):
            source.unlink()
            return target

        backup = target_dir / f"{filename}.bak-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        shutil.move(str(target), str(backup))

    shutil.move(str(source), str(target))
    return target


def migrate_known_root_databases(
    *,
    filenames: Iterable[str] | None = None,
    project_root: Path | None = None,
    data_dir: Path | None = None,
) -> list[Path]:
    moved: list[Path] = []
    for filename in filenames or KNOWN_DB_FILENAMES:
        moved.append(
            managed_db_path(
                filename,
                project_root=project_root,
                data_dir=data_dir,
            )
        )
    return moved


def migrate_known_root_logs(
    *,
    filenames: Iterable[str] | None = None,
    project_root: Path | None = None,
    logs_dir: Path | None = None,
) -> list[Path]:
    moved: list[Path] = []
    for filename in filenames or KNOWN_LOG_FILENAMES:
        moved.append(
            managed_log_path(
                filename,
                project_root=project_root,
                logs_dir=logs_dir,
            )
        )
    return moved
