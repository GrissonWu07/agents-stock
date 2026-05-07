from pathlib import Path

from app.db.bootstrap import bootstrap_database_runtime
from app.gateway.context import UIApiContext
from app.quant_sim.engine import QuantSimEngine
from app.quant_sim.scheduler import QuantSimScheduler


def test_ui_api_context_runtime_managed_services_propagate_db_runtime(tmp_path: Path):
    runtime = bootstrap_database_runtime({}, data_dir=tmp_path)
    context = UIApiContext(data_dir=tmp_path, logs_dir=tmp_path / "logs", db_runtime=runtime)

    assert context.watchlist().db.db_runtime is runtime
    assert context.candidate_pool().db.db_runtime is runtime
    assert context.portfolio().db.db_runtime is runtime
    assert context.quant_db().db_runtime is runtime


def test_quant_sim_engine_propagates_db_runtime_to_nested_services(tmp_path: Path):
    runtime = bootstrap_database_runtime({}, data_dir=tmp_path)

    engine = QuantSimEngine(
        db_file=tmp_path / "xuanwu_stock.db",
        stock_analysis_db_file=tmp_path / "xuanwu_stock.db",
        db_runtime=runtime,
    )

    assert engine.candidate_pool.db.db_runtime is runtime
    assert engine.signal_center.db.db_runtime is runtime
    assert engine.portfolio.db.db_runtime is runtime
    assert engine.watchlist.db.db_runtime is runtime
    assert engine.dynamic_strategy.db.db_runtime is runtime
    assert engine.stock_analysis_context.db_runtime is runtime


def test_quant_sim_engine_defaults_stock_analysis_store_to_custom_db_file(tmp_path: Path):
    engine = QuantSimEngine(db_file=tmp_path / "app.quant_sim.db")

    assert Path(engine.stock_analysis_db_file) == tmp_path / "app.quant_sim.db"


def test_quant_sim_scheduler_propagates_db_runtime_to_engine_and_portfolio(tmp_path: Path):
    runtime = bootstrap_database_runtime({}, data_dir=tmp_path)

    scheduler = QuantSimScheduler(
        db_file=tmp_path / "xuanwu_stock.db",
        stock_analysis_db_file=tmp_path / "xuanwu_stock.db",
        db_runtime=runtime,
    )
    scheduler.stop()

    assert scheduler.db.db_runtime is runtime
    assert scheduler.engine.candidate_pool.db.db_runtime is runtime
    assert scheduler.engine.signal_center.db.db_runtime is runtime
    assert scheduler.portfolio.db.db_runtime is runtime


def test_quant_sim_scheduler_defaults_stock_analysis_store_to_custom_db_file(tmp_path: Path):
    scheduler = QuantSimScheduler(db_file=tmp_path / "app.quant_sim.db")
    scheduler.stop()

    assert Path(scheduler.stock_analysis_db_file) == tmp_path / "app.quant_sim.db"
    assert Path(scheduler.engine.stock_analysis_db_file) == tmp_path / "app.quant_sim.db"
