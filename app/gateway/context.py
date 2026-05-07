from __future__ import annotations

from app.db.bootstrap import bootstrap_database_runtime
from app.db.runtime.registry import DatabaseRuntime
from app.data_source_manager import data_source_manager
from app.gateway.deps import *

@dataclass
class UIApiContext:
    data_dir: Path | str = DATA_DIR
    selector_result_dir: Path | str = DEFAULT_SELECTOR_RESULT_DIR
    quant_sim_db_file: Path | str | None = None
    quant_sim_replay_db_file: Path | str | None = None
    monitor_db_file: Path | str | None = None
    smart_monitor_db_file: Path | str | None = None
    stock_analysis_db_file: Path | str | None = None
    main_force_batch_db_file: Path | str | None = None
    logs_dir: Path | str = LOGS_DIR
    config_manager: ConfigManager = config_manager
    discover_result_key: str = "main_force"
    research_result_key: str = "research"
    stock_name_resolver: Callable[[str], str] | None = None
    workbench_analysis_cache: dict[str, Any] | None = None
    workbench_analysis_job_cache: dict[str, Any] | None = None
    db_runtime: DatabaseRuntime | None = None

    def __post_init__(self) -> None:
        self.data_dir = _p(self.data_dir)
        self.selector_result_dir = _p(self.selector_result_dir)
        self.logs_dir = _p(self.logs_dir)
        self.db_runtime = self.db_runtime or bootstrap_database_runtime(data_dir=self.data_dir)
        primary_path = self.db_runtime.primary_path or default_db_path("xuanwu_stock.db", data_dir=self.data_dir)
        replay_path = self.db_runtime.replay_path or default_db_path("xuanwu_stock_replay.db", data_dir=self.data_dir)
        self.quant_sim_db_file = _p(self.quant_sim_db_file or primary_path)
        self.quant_sim_replay_db_file = _p(self.quant_sim_replay_db_file or replay_path)
        self.monitor_db_file = _p(self.monitor_db_file or primary_path)
        self.smart_monitor_db_file = _p(self.smart_monitor_db_file or primary_path)
        self.stock_analysis_db_file = _p(self.stock_analysis_db_file or primary_path)
        self.main_force_batch_db_file = _p(self.main_force_batch_db_file or primary_path)
        config_db_file = Path(getattr(self.config_manager, "db_file", self.quant_sim_db_file))
        if config_db_file == default_db_path("xuanwu_stock.db"):
            self.config_manager.db_file = self.quant_sim_db_file
        self.config_manager.db_runtime = self.db_runtime
        try:
            self.config_manager._init_db()
            self.config_manager._bootstrap_from_env_once()
        except Exception:
            pass
        if self.stock_name_resolver is None:
            self.stock_name_resolver = self._resolve_stock_name

    @staticmethod
    def _resolve_stock_name(stock_code: str) -> str:
        code = normalize_stock_code(stock_code)
        if not code:
            return ""
        try:
            info = data_source_manager.get_stock_basic_info(code)
        except Exception:
            return code
        if isinstance(info, dict):
            name = _txt(info.get("name") or info.get("stock_name") or info.get("股票简称"))
            if name:
                return name
        return code

    def watchlist(self) -> WatchlistService:
        return WatchlistService(self.quant_sim_db_file, db_runtime=self.db_runtime)

    def candidate_pool(self) -> CandidatePoolService:
        return CandidatePoolService(self.quant_sim_db_file, db_runtime=self.db_runtime)

    def portfolio(self) -> PortfolioService:
        return PortfolioService(self.quant_sim_db_file, db_runtime=self.db_runtime)

    def quant_db(self) -> QuantSimDB:
        return QuantSimDB(self.quant_sim_db_file, db_runtime=self.db_runtime)

    def replay_db(self):
        from app.quant_sim.db import QuantSimReplayDB

        return QuantSimReplayDB(self.quant_sim_replay_db_file, db_runtime=self.db_runtime, pin_connection=True)

    def scheduler(self):
        return get_quant_sim_scheduler(
            db_file=self.quant_sim_db_file,
            stock_analysis_db_file=self.stock_analysis_db_file,
            db_runtime=self.db_runtime,
        )

    def replay_service(self):
        return QuantSimReplayService(
            db_file=self.quant_sim_db_file,
            replay_db_file=self.quant_sim_replay_db_file,
            db_runtime=self.db_runtime,
        )

    def portfolio_manager(self):
        from app.portfolio_manager import PortfolioManager

        portfolio_db.db_path = str(self.quant_sim_db_file)
        portfolio_db.db_runtime = self.db_runtime
        try:
            portfolio_db._init_database()
        except Exception:
            pass
        return PortfolioManager()

    def portfolio_scheduler(self):
        from app.portfolio_scheduler import portfolio_scheduler

        portfolio_db.db_path = str(self.quant_sim_db_file)
        portfolio_db.db_runtime = self.db_runtime
        try:
            portfolio_db._init_database()
        except Exception:
            pass
        return portfolio_scheduler

    def smart_monitor_db(self):
        from app.smart_monitor_db import SmartMonitorDB

        return SmartMonitorDB(str(self.smart_monitor_db_file), db_runtime=self.db_runtime)

    def smart_monitor_engine(self):
        from app.smart_monitor_engine import SmartMonitorEngine

        return SmartMonitorEngine()

    def monitor_db(self):
        monitor_db.db_path = str(self.monitor_db_file)
        monitor_db.db_runtime = self.db_runtime
        try:
            monitor_db.init_database()
        except Exception:
            pass
        return monitor_db

    def real_monitor_scheduler(self):
        from app.monitor_scheduler import get_scheduler
        from app.monitor_service import monitor_service

        self.monitor_db()
        return get_scheduler(monitor_service)

    def stock_analysis_db(self):
        return StockAnalysisDatabase(str(self.stock_analysis_db_file), db_runtime=self.db_runtime)

    def main_force_batch_db(self):
        return MainForceBatchDatabase(str(self.main_force_batch_db_file), db_runtime=self.db_runtime)

    def set_workbench_analysis(self, payload: dict[str, Any] | None) -> None:
        self.workbench_analysis_cache = dict(payload) if isinstance(payload, dict) else None

    def get_workbench_analysis(self) -> dict[str, Any] | None:
        return dict(self.workbench_analysis_cache) if isinstance(self.workbench_analysis_cache, dict) else None

    def set_workbench_analysis_job(self, payload: dict[str, Any] | None) -> None:
        self.workbench_analysis_job_cache = dict(payload) if isinstance(payload, dict) else None

    def get_workbench_analysis_job(self) -> dict[str, Any] | None:
        return dict(self.workbench_analysis_job_cache) if isinstance(self.workbench_analysis_job_cache, dict) else None
