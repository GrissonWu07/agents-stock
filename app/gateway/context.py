from __future__ import annotations

from app.gateway.deps import *

@dataclass
class UIApiContext:
    data_dir: Path | str = DATA_DIR
    selector_result_dir: Path | str = DEFAULT_SELECTOR_RESULT_DIR
    watchlist_db_file: Path | str = field(default_factory=lambda: default_db_path("watchlist.db"))
    quant_sim_db_file: Path | str = field(default_factory=lambda: default_db_path("quant_sim.db"))
    quant_sim_replay_db_file: Path | str = field(default_factory=lambda: default_db_path("quant_sim_replay.db"))
    portfolio_db_file: Path | str = field(default_factory=lambda: default_db_path("portfolio_stocks.db"))
    monitor_db_file: Path | str = field(default_factory=lambda: default_db_path("stock_monitor.db"))
    smart_monitor_db_file: Path | str = field(default_factory=lambda: default_db_path("smart_monitor.db"))
    stock_analysis_db_file: Path | str = field(default_factory=lambda: default_db_path("stock_analysis.db"))
    main_force_batch_db_file: Path | str = field(default_factory=lambda: default_db_path("main_force_batch.db"))
    logs_dir: Path | str = LOGS_DIR
    config_manager: ConfigManager = config_manager
    stock_name_resolver: Callable[[str], str] | None = None
    quote_fetcher: Callable[[str, str | None], dict[str, Any] | None] | None = None
    basic_info_fetcher: Callable[[str], dict[str, Any] | None] | None = None
    discover_result_key: str = "main_force"
    research_result_key: str = "research"
    workbench_analysis_cache: dict[str, Any] | None = None
    workbench_analysis_job_cache: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        self.data_dir = _p(self.data_dir)
        self.selector_result_dir = _p(self.selector_result_dir)
        self.watchlist_db_file = _p(self.watchlist_db_file)
        self.quant_sim_db_file = _p(self.quant_sim_db_file)
        self.quant_sim_replay_db_file = _p(self.quant_sim_replay_db_file)
        self.portfolio_db_file = _p(self.portfolio_db_file)
        self.monitor_db_file = _p(self.monitor_db_file)
        self.smart_monitor_db_file = _p(self.smart_monitor_db_file)
        self.stock_analysis_db_file = _p(self.stock_analysis_db_file)
        self.main_force_batch_db_file = _p(self.main_force_batch_db_file)
        self.logs_dir = _p(self.logs_dir)

    def watchlist(self) -> WatchlistService:
        return WatchlistService(
            self.watchlist_db_file,
            stock_name_resolver=self.stock_name_resolver,
            quote_fetcher=self.quote_fetcher,
            basic_info_fetcher=self.basic_info_fetcher,
        )

    def candidate_pool(self) -> CandidatePoolService:
        return CandidatePoolService(self.quant_sim_db_file)

    def portfolio(self) -> PortfolioService:
        return PortfolioService(self.quant_sim_db_file)

    def quant_db(self) -> QuantSimDB:
        return QuantSimDB(self.quant_sim_db_file)

    def replay_db(self):
        from app.quant_sim.db import QuantSimReplayDB

        return QuantSimReplayDB(self.quant_sim_replay_db_file)

    def scheduler(self):
        return get_quant_sim_scheduler(
            db_file=self.quant_sim_db_file,
            watchlist_db_file=self.watchlist_db_file,
            stock_analysis_db_file=self.stock_analysis_db_file,
        )

    def replay_service(self):
        return QuantSimReplayService(
            db_file=self.quant_sim_db_file,
            replay_db_file=self.quant_sim_replay_db_file,
        )

    def portfolio_manager(self):
        from app.portfolio_manager import PortfolioManager

        portfolio_db.db_path = str(self.portfolio_db_file)
        try:
            portfolio_db._init_database()
        except Exception:
            pass
        return PortfolioManager()

    def portfolio_scheduler(self):
        from app.portfolio_scheduler import portfolio_scheduler

        portfolio_db.db_path = str(self.portfolio_db_file)
        try:
            portfolio_db._init_database()
        except Exception:
            pass
        return portfolio_scheduler

    def smart_monitor_db(self):
        from app.smart_monitor_db import SmartMonitorDB

        return SmartMonitorDB(str(self.smart_monitor_db_file))

    def smart_monitor_engine(self):
        from app.smart_monitor_engine import SmartMonitorEngine

        return SmartMonitorEngine()

    def monitor_db(self):
        monitor_db.db_path = str(self.monitor_db_file)
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
        return StockAnalysisDatabase(str(self.stock_analysis_db_file))

    def main_force_batch_db(self):
        return MainForceBatchDatabase(str(self.main_force_batch_db_file))

    def set_workbench_analysis(self, payload: dict[str, Any] | None) -> None:
        self.workbench_analysis_cache = dict(payload) if isinstance(payload, dict) else None

    def get_workbench_analysis(self) -> dict[str, Any] | None:
        return dict(self.workbench_analysis_cache) if isinstance(self.workbench_analysis_cache, dict) else None

    def set_workbench_analysis_job(self, payload: dict[str, Any] | None) -> None:
        self.workbench_analysis_job_cache = dict(payload) if isinstance(payload, dict) else None

    def get_workbench_analysis_job(self) -> dict[str, Any] | None:
        return dict(self.workbench_analysis_job_cache) if isinstance(self.workbench_analysis_job_cache, dict) else None
