"""Historical replay orchestration for quant simulation."""

from __future__ import annotations

import shutil
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd

from data_source_manager import data_source_manager
from quant_kernel import ReplayTimepointGenerator
from quant_sim.candidate_pool_service import CandidatePoolService
from quant_sim.db import DEFAULT_DB_FILE, QuantSimDB
from quant_sim.engine import QuantSimEngine
from quant_sim.portfolio_service import PortfolioService
from quant_sim.scheduler import get_quant_sim_scheduler
from quant_sim.signal_center_service import SignalCenterService
from quant_sim.stockpolicy_adapter import StockPolicyAdapter
from smart_monitor_tdx_data import SmartMonitorTDXDataFetcher


class MainProjectHistoricalSnapshotProvider:
    """Build replay snapshots using the main project's market-data stack."""

    DAILY_LOOKBACK_DAYS = 180
    INTRADAY_LOOKBACK_DAYS = 45

    def __init__(
        self,
        *,
        tdx_fetcher: Optional[SmartMonitorTDXDataFetcher] = None,
    ):
        self.tdx_fetcher = tdx_fetcher or SmartMonitorTDXDataFetcher()
        self.cache: dict[tuple[str, str], pd.DataFrame] = {}

    def prepare(
        self,
        stock_codes: list[str],
        start_datetime: datetime,
        end_datetime: datetime,
        timeframe: str,
    ) -> None:
        data_timeframe = self._normalize_data_timeframe(timeframe)
        for stock_code in stock_codes:
            self.cache[(stock_code, timeframe)] = self._load_history(
                stock_code,
                start_datetime=start_datetime,
                end_datetime=end_datetime,
                timeframe=data_timeframe,
            )

    def get_snapshot(self, stock_code: str, checkpoint: datetime, timeframe: str) -> Optional[dict]:
        history = self.cache.get((stock_code, timeframe))
        if history is None or history.empty:
            return None

        window = history[history["日期"] <= pd.Timestamp(checkpoint)]
        if window.empty:
            return None

        snapshot_window = window.tail(240).reset_index(drop=True)
        return self.tdx_fetcher.build_snapshot_from_history(stock_code, snapshot_window)

    def _load_history(
        self,
        stock_code: str,
        *,
        start_datetime: datetime,
        end_datetime: datetime,
        timeframe: str,
    ) -> pd.DataFrame:
        normalized = self._normalize_data_timeframe(timeframe)
        if normalized in {"1d", "day", "daily"}:
            start_date = (start_datetime - timedelta(days=self.DAILY_LOOKBACK_DAYS)).strftime("%Y%m%d")
            end_date = end_datetime.strftime("%Y%m%d")
            df = data_source_manager.get_stock_hist_data(stock_code, start_date=start_date, end_date=end_date, adjust="qfq")
            return self._normalize_daily_history(df)

        if normalized in {"30m", "30min", "minute30"}:
            return self.tdx_fetcher.get_kline_data_range(
                stock_code,
                kline_type="minute30",
                start_datetime=start_datetime - timedelta(days=self.INTRADAY_LOOKBACK_DAYS),
                end_datetime=end_datetime,
                max_bars=3200,
            ) or pd.DataFrame(columns=["日期", "开盘", "收盘", "最高", "最低", "成交量", "成交额"])

        raise ValueError(f"Unsupported replay timeframe: {timeframe}")

    @staticmethod
    def _normalize_data_timeframe(timeframe: str) -> str:
        normalized = str(timeframe).lower()
        if normalized == "1d+30m":
            return "30m"
        return normalized

    @staticmethod
    def _normalize_daily_history(df) -> pd.DataFrame:
        if df is None or isinstance(df, dict) or len(df) == 0:
            return pd.DataFrame(columns=["日期", "开盘", "收盘", "最高", "最低", "成交量", "成交额"])

        frame = pd.DataFrame(df).copy()
        rename_map = {
            "date": "日期",
            "open": "开盘",
            "close": "收盘",
            "high": "最高",
            "low": "最低",
            "volume": "成交量",
            "amount": "成交额",
        }
        frame = frame.rename(columns=rename_map)
        required = ["日期", "开盘", "收盘", "最高", "最低", "成交量", "成交额"]
        missing = [column for column in required if column not in frame.columns]
        for column in missing:
            frame[column] = 0
        frame["日期"] = pd.to_datetime(frame["日期"])
        return frame[required].sort_values("日期").reset_index(drop=True)


class QuantSimReplayService:
    """Execute historical-range replay runs and persist their artifacts."""

    def __init__(
        self,
        db_file: str | Path = DEFAULT_DB_FILE,
        *,
        snapshot_provider: Optional[MainProjectHistoricalSnapshotProvider] = None,
        adapter: Optional[StockPolicyAdapter] = None,
        timepoint_generator: Optional[ReplayTimepointGenerator] = None,
    ):
        self.db_file = str(db_file)
        self.db = QuantSimDB(db_file)
        self.snapshot_provider = snapshot_provider or MainProjectHistoricalSnapshotProvider()
        self.adapter = adapter or StockPolicyAdapter()
        self.timepoint_generator = timepoint_generator or ReplayTimepointGenerator()

    def run_historical_range(
        self,
        *,
        start_datetime: datetime | str,
        end_datetime: datetime | str | None,
        timeframe: str,
        market: str,
    ) -> dict:
        return self._execute_replay(
            mode="historical_range",
            handoff_to_live=False,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            timeframe=timeframe,
            market=market,
        )

    def run_past_to_live(
        self,
        *,
        start_datetime: datetime | str,
        end_datetime: datetime | str | None,
        timeframe: str,
        market: str,
        overwrite_live: bool = False,
        auto_start_scheduler: bool = True,
    ) -> dict:
        live_account = self.db.get_account_summary()
        if not overwrite_live and (live_account["trade_count"] > 0 or live_account["position_count"] > 0):
            raise ValueError("当前实时模拟账户已有交易或持仓，请勾选覆盖后再执行接续模拟")

        summary = self._execute_replay(
            mode="continuous_to_live",
            handoff_to_live=True,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            timeframe=timeframe,
            market=market,
        )

        scheduler = get_quant_sim_scheduler(db_file=self.db_file)
        status = scheduler.get_status()
        scheduler.update_config(
            enabled=bool(auto_start_scheduler),
            auto_execute=True,
            interval_minutes=int(status["interval_minutes"]),
            trading_hours_only=bool(status["trading_hours_only"]),
            analysis_timeframe=timeframe,
            market=market,
        )
        if auto_start_scheduler:
            scheduler.start()

        summary["handoff_to_live"] = True
        return summary

    def _execute_replay(
        self,
        *,
        mode: str,
        handoff_to_live: bool,
        start_datetime: datetime | str,
        end_datetime: datetime | str | None,
        timeframe: str,
        market: str,
    ) -> dict:
        start_dt = self._to_datetime(start_datetime)
        end_dt = self._resolve_end_datetime(end_datetime)
        if start_dt >= end_dt:
            raise ValueError("start_datetime must be before end_datetime")

        candidates = CandidatePoolService(db_file=self.db_file).list_candidates(status="active")
        if not candidates:
            raise ValueError("候选池为空，无法执行历史区间模拟")

        stock_codes = [str(candidate["stock_code"]) for candidate in candidates]
        checkpoints = self.timepoint_generator.generate(start_dt, end_dt, timeframe)
        if not checkpoints:
            raise ValueError("指定区间内没有可用的交易检查点")

        account_summary = self.db.get_account_summary()
        run_id = self.db.create_sim_run(
            mode=mode,
            timeframe=timeframe,
            market=market,
            start_datetime=self._format_datetime(start_dt),
            end_datetime=self._format_datetime(end_dt),
            initial_cash=float(account_summary["initial_cash"]),
            auto_execute=True,
            handoff_to_live=handoff_to_live,
            metadata={"candidate_count": len(candidates)},
        )

        temp_dir = Path(tempfile.mkdtemp(prefix="quant_replay_"))
        temp_db_file = temp_dir / "quant_replay.db"

        try:
            temp_candidate_service = CandidatePoolService(db_file=temp_db_file)
            temp_portfolio = PortfolioService(db_file=temp_db_file)
            temp_engine = QuantSimEngine(db_file=temp_db_file, adapter=self.adapter)
            temp_signal_service = SignalCenterService(db_file=temp_db_file)
            temp_db = QuantSimDB(temp_db_file)

            temp_portfolio.configure_account(float(account_summary["initial_cash"]))
            for candidate in candidates:
                temp_candidate_service.add_candidate(
                    stock_code=str(candidate["stock_code"]),
                    stock_name=str(candidate.get("stock_name") or ""),
                    source=str(candidate.get("source") or "manual"),
                    latest_price=float(candidate.get("latest_price") or 0),
                    notes=candidate.get("notes"),
                    metadata=candidate.get("metadata") or {},
                    status="active",
                )

            self.snapshot_provider.prepare(stock_codes, start_dt, end_dt, timeframe)

            for checkpoint in checkpoints:
                checkpoint_summary = self._run_checkpoint(
                    checkpoint=checkpoint,
                    timeframe=timeframe,
                    engine=temp_engine,
                    portfolio=temp_portfolio,
                    signal_service=temp_signal_service,
                )
                self.db.add_sim_run_checkpoint(
                    run_id,
                    checkpoint_at=self._format_datetime(checkpoint),
                    candidates_scanned=int(checkpoint_summary["candidates_scanned"]),
                    positions_checked=int(checkpoint_summary["positions_checked"]),
                    signals_created=int(checkpoint_summary["signals_created"]),
                    auto_executed=int(checkpoint_summary["auto_executed"]),
                    available_cash=float(checkpoint_summary["available_cash"]),
                    market_value=float(checkpoint_summary["market_value"]),
                    total_equity=float(checkpoint_summary["total_equity"]),
                )

            trades = temp_db.get_trade_history(limit=10000)
            snapshots = self._sort_snapshots_chronologically(
                [
                    snapshot
                    for snapshot in temp_db.get_account_snapshots(limit=10000)
                    if str(snapshot.get("run_reason") or "").startswith("historical_range@")
                ]
            )
            positions = temp_portfolio.list_positions()
            lots = self._collect_open_lots(temp_db, positions, as_of=end_dt)
            self.db.replace_sim_run_results(run_id, trades=trades, snapshots=snapshots, positions=positions)

            metrics = self._calculate_run_metrics(account_summary["initial_cash"], trades, snapshots)
            self.db.finalize_sim_run(
                run_id,
                status="completed",
                final_equity=float(metrics["final_equity"]),
                total_return_pct=float(metrics["total_return_pct"]),
                max_drawdown_pct=float(metrics["max_drawdown_pct"]),
                win_rate=float(metrics["win_rate"]),
                trade_count=len(trades),
                metadata={"checkpoint_count": len(checkpoints)},
            )

            if handoff_to_live:
                self.db.replace_runtime_state(
                    initial_cash=float(account_summary["initial_cash"]),
                    available_cash=float(temp_portfolio.get_account_summary()["available_cash"]),
                    positions=positions,
                    lots=lots,
                    trades=trades,
                    snapshots=snapshots,
                )

            return {
                "run_id": run_id,
                "status": "completed",
                "checkpoint_count": len(checkpoints),
                "trade_count": len(trades),
                "final_equity": metrics["final_equity"],
                "total_return_pct": metrics["total_return_pct"],
                "max_drawdown_pct": metrics["max_drawdown_pct"],
                "win_rate": metrics["win_rate"],
                "handoff_to_live": handoff_to_live,
            }
        except Exception as exc:
            self.db.finalize_sim_run(
                run_id,
                status="failed",
                final_equity=float(account_summary["initial_cash"]),
                total_return_pct=0.0,
                max_drawdown_pct=0.0,
                win_rate=0.0,
                trade_count=0,
                metadata={"error": str(exc)},
            )
            raise
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def _run_checkpoint(
        self,
        *,
        checkpoint: datetime,
        timeframe: str,
        engine: QuantSimEngine,
        portfolio: PortfolioService,
        signal_service: SignalCenterService,
    ) -> dict:
        candidates = engine.candidate_pool.list_candidates(status="active")
        positions = portfolio.list_positions()
        signals_created = 0

        for candidate in candidates:
            snapshot = self.snapshot_provider.get_snapshot(candidate["stock_code"], checkpoint, timeframe)
            if not snapshot:
                continue
            decision = engine._evaluate_candidate_decision(
                candidate,
                market_snapshot=snapshot,
                analysis_timeframe=timeframe,
            )
            decision_price = engine._extract_decision_price(decision)
            if decision_price > 0:
                engine.candidate_pool.db.update_candidate_latest_price(candidate["stock_code"], decision_price)
            signal_service.create_signal(candidate, decision)
            signals_created += 1

        for position in positions:
            candidate = engine.candidate_pool.db.get_candidate(position["stock_code"]) or {
                "stock_code": position["stock_code"],
                "stock_name": position.get("stock_name"),
                "source": "manual",
                "sources": ["manual"],
            }
            snapshot = self.snapshot_provider.get_snapshot(position["stock_code"], checkpoint, timeframe)
            if not snapshot:
                continue
            decision = engine._evaluate_position_decision(
                candidate,
                position,
                market_snapshot=snapshot,
                analysis_timeframe=timeframe,
            )
            decision_price = engine._extract_decision_price(decision)
            if decision_price > 0:
                portfolio.db.update_position_market_price(position["stock_code"], decision_price)
                portfolio.db.update_candidate_latest_price(position["stock_code"], decision_price)
            signal_service.create_signal(candidate, decision)
            signals_created += 1

        auto_executed = 0
        for signal in signal_service.list_pending_signals():
            if portfolio.auto_execute_signal(signal, note="历史回放自动执行", executed_at=checkpoint):
                auto_executed += 1

        portfolio.db.add_account_snapshot(run_reason=f"historical_range@{self._format_datetime(checkpoint)}")
        account_summary = portfolio.get_account_summary()
        return {
            "candidates_scanned": len(candidates),
            "positions_checked": len(positions),
            "signals_created": signals_created,
            "auto_executed": auto_executed,
            "available_cash": account_summary["available_cash"],
            "market_value": account_summary["market_value"],
            "total_equity": account_summary["total_equity"],
        }

    @staticmethod
    def _collect_open_lots(temp_db: QuantSimDB, positions: list[dict], *, as_of: datetime) -> list[dict]:
        lots: list[dict] = []
        for position in positions:
            stock_code = str(position.get("stock_code") or "")
            if not stock_code:
                continue
            lots.extend(temp_db.get_position_lots(stock_code, as_of=as_of))
        return lots

    @staticmethod
    def _calculate_run_metrics(initial_cash: float, trades: list[dict], snapshots: list[dict]) -> dict:
        snapshot_equity_curve = [float(snapshot.get("total_equity") or 0) for snapshot in snapshots]
        final_equity = snapshot_equity_curve[-1] if snapshot_equity_curve else float(initial_cash)

        peak = float(initial_cash)
        max_drawdown_pct = 0.0
        for equity in snapshot_equity_curve:
            peak = max(peak, equity)
            if peak <= 0:
                continue
            drawdown_pct = (peak - equity) / peak * 100
            max_drawdown_pct = max(max_drawdown_pct, drawdown_pct)

        closed_trades = [trade for trade in trades if str(trade.get("action")).upper() == "SELL"]
        profitable_trades = [trade for trade in closed_trades if float(trade.get("realized_pnl") or 0) > 0]
        win_rate = (len(profitable_trades) / len(closed_trades) * 100) if closed_trades else 0.0

        return {
            "final_equity": round(final_equity, 4),
            "total_return_pct": round(((final_equity - initial_cash) / initial_cash * 100) if initial_cash > 0 else 0.0, 4),
            "max_drawdown_pct": round(max_drawdown_pct, 4),
            "win_rate": round(win_rate, 4),
        }

    @staticmethod
    def _to_datetime(value: datetime | str) -> datetime:
        if isinstance(value, datetime):
            return value.replace(microsecond=0)
        return datetime.fromisoformat(str(value).replace("T", " ")).replace(microsecond=0)

    def _resolve_end_datetime(self, value: datetime | str | None) -> datetime:
        if value is None:
            return self._current_time()
        return self._to_datetime(value)

    def _current_time(self) -> datetime:
        return datetime.now().replace(microsecond=0)

    def _sort_snapshots_chronologically(self, snapshots: list[dict]) -> list[dict]:
        return sorted(
            snapshots,
            key=lambda snapshot: (
                self._extract_snapshot_checkpoint_time(snapshot),
                int(snapshot.get("id") or 0),
            ),
        )

    def _extract_snapshot_checkpoint_time(self, snapshot: dict) -> datetime:
        run_reason = str(snapshot.get("run_reason") or "")
        if "@" in run_reason:
            _, _, suffix = run_reason.partition("@")
            try:
                return self._to_datetime(suffix)
            except ValueError:
                pass
        created_at = snapshot.get("created_at")
        if created_at:
            try:
                return self._to_datetime(str(created_at))
            except ValueError:
                pass
        return datetime.min

    @staticmethod
    def _format_datetime(value: datetime) -> str:
        return value.replace(microsecond=0).isoformat(sep=" ")
