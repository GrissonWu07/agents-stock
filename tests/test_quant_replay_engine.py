from datetime import datetime

from quant_kernel.models import Decision
from quant_sim.candidate_pool_service import CandidatePoolService
from quant_sim.db import QuantSimDB
from quant_sim.replay_service import QuantSimReplayService


class FakeSnapshotProvider:
    def __init__(self):
        self.prepared = []

    def prepare(self, stock_codes, start_datetime, end_datetime, timeframe):
        self.prepared.append((tuple(stock_codes), start_datetime, end_datetime, timeframe))

    def get_snapshot(self, stock_code, checkpoint, timeframe):
        if checkpoint.date() == datetime(2026, 1, 5).date():
            price = 10.0
        else:
            price = 12.0
        return {
            "current_price": price,
            "latest_price": price,
            "ma5": price - 0.2,
            "ma20": price - 0.5,
            "ma60": price - 0.8,
            "macd": 0.6 if price <= 10 else -0.7,
            "rsi12": 55.0 if price <= 10 else 78.0,
            "volume_ratio": 1.5,
            "trend": "up" if price <= 10 else "down",
        }


class FakeAdapter:
    def __init__(self):
        self.candidate_calls = []
        self.position_calls = []

    def analyze_candidate(self, candidate, market_snapshot=None, analysis_timeframe="1d"):
        self.candidate_calls.append(
            {
                "stock_code": candidate["stock_code"],
                "analysis_timeframe": analysis_timeframe,
            }
        )
        price = float((market_snapshot or {}).get("current_price") or 0)
        if price <= 10:
            return Decision(
                code=candidate["stock_code"],
                action="BUY",
                confidence=0.82,
                price=price,
                timestamp=datetime(2026, 1, 5, 14, 50),
                reason="历史回放买入信号",
                tech_score=0.72,
                context_score=0.28,
                position_ratio=0.6,
                decision_type="dual_track_resonance",
                strategy_profile={"analysis_timeframe": {"key": analysis_timeframe}},
            )
        return Decision(
            code=candidate["stock_code"],
            action="HOLD",
            confidence=0.6,
            price=price,
            timestamp=datetime(2026, 1, 6, 14, 50),
            reason="历史回放继续观察",
            tech_score=0.1,
            context_score=0.28,
            position_ratio=0.0,
            decision_type="single_track",
            strategy_profile={"analysis_timeframe": {"key": analysis_timeframe}},
        )

    def analyze_position(self, candidate, position, market_snapshot=None, analysis_timeframe="1d"):
        self.position_calls.append(
            {
                "stock_code": position["stock_code"],
                "analysis_timeframe": analysis_timeframe,
            }
        )
        price = float((market_snapshot or {}).get("current_price") or 0)
        return Decision(
            code=position["stock_code"],
            action="SELL" if price >= 12 else "HOLD",
            confidence=0.84,
            price=price,
            timestamp=datetime(2026, 1, 6, 14, 50),
            reason="历史回放卖出信号",
            tech_score=-0.45,
            context_score=0.12,
            position_ratio=0.0,
            decision_type="dual_track_divergence",
            strategy_profile={"analysis_timeframe": {"key": analysis_timeframe}},
        )


def test_historical_replay_persists_run_artifacts_without_touching_live_account(tmp_path):
    db_file = tmp_path / "quant_sim.db"
    candidate_service = CandidatePoolService(db_file=db_file)
    candidate_service.add_candidate(
        stock_code="300390",
        stock_name="天华新能",
        source="main_force",
        latest_price=10.0,
        notes="回放测试",
    )

    replay_service = QuantSimReplayService(
        db_file=db_file,
        snapshot_provider=FakeSnapshotProvider(),
        adapter=FakeAdapter(),
    )

    summary = replay_service.run_historical_range(
        start_datetime=datetime(2026, 1, 5, 0, 0),
        end_datetime=datetime(2026, 1, 6, 23, 59),
        timeframe="1d",
        market="CN",
    )

    db = QuantSimDB(db_file)
    runs = db.get_sim_runs(limit=5)
    run = runs[0]
    checkpoints = db.get_sim_run_checkpoints(run["id"])
    trades = db.get_sim_run_trades(run["id"])
    snapshots = db.get_sim_run_snapshots(run["id"])
    live_account = db.get_account_summary()

    assert summary["status"] == "completed"
    assert summary["trade_count"] == 2
    assert summary["checkpoint_count"] == 2
    assert run["mode"] == "historical_range"
    assert run["status"] == "completed"
    assert run["timeframe"] == "1d"
    assert run["trade_count"] == 2
    assert summary["final_equity"] == 112000.0
    assert summary["total_return_pct"] == 12.0
    assert float(run["final_equity"]) == 112000.0
    assert len(checkpoints) == 2
    assert [trade["action"] for trade in trades] == ["SELL", "BUY"]
    assert len(snapshots) == 2
    assert live_account["trade_count"] == 0
    assert live_account["position_count"] == 0
    assert live_account["available_cash"] == 100000.0


def test_historical_replay_allows_open_ended_end_datetime(tmp_path):
    db_file = tmp_path / "quant_sim.db"
    candidate_service = CandidatePoolService(db_file=db_file)
    candidate_service.add_candidate(
        stock_code="300390",
        stock_name="天华新能",
        source="main_force",
        latest_price=10.0,
        notes="回放测试",
    )

    snapshot_provider = FakeSnapshotProvider()
    replay_service = QuantSimReplayService(
        db_file=db_file,
        snapshot_provider=snapshot_provider,
        adapter=FakeAdapter(),
    )
    replay_service._current_time = lambda: datetime(2026, 1, 6, 23, 59)  # type: ignore[attr-defined]

    summary = replay_service.run_historical_range(
        start_datetime=datetime(2026, 1, 5, 0, 0),
        end_datetime=None,
        timeframe="1d",
        market="CN",
    )

    assert summary["status"] == "completed"
    assert snapshot_provider.prepared[0][2] == datetime(2026, 1, 6, 23, 59)


def test_historical_replay_passes_requested_timeframe_to_adapter(tmp_path):
    db_file = tmp_path / "quant_sim.db"
    candidate_service = CandidatePoolService(db_file=db_file)
    candidate_service.add_candidate(
        stock_code="300390",
        stock_name="天华新能",
        source="main_force",
        latest_price=10.0,
        notes="回放测试",
    )

    adapter = FakeAdapter()
    replay_service = QuantSimReplayService(
        db_file=db_file,
        snapshot_provider=FakeSnapshotProvider(),
        adapter=adapter,
    )

    summary = replay_service.run_historical_range(
        start_datetime=datetime(2026, 1, 5, 0, 0),
        end_datetime=datetime(2026, 1, 6, 23, 59),
        timeframe="30m",
        market="CN",
    )

    assert summary["status"] == "completed"
    assert adapter.candidate_calls[0]["analysis_timeframe"] == "30m"


def test_historical_replay_supports_resonance_timeframe(tmp_path):
    db_file = tmp_path / "quant_sim.db"
    candidate_service = CandidatePoolService(db_file=db_file)
    candidate_service.add_candidate(
        stock_code="300390",
        stock_name="天华新能",
        source="main_force",
        latest_price=10.0,
        notes="回放测试",
    )

    adapter = FakeAdapter()
    replay_service = QuantSimReplayService(
        db_file=db_file,
        snapshot_provider=FakeSnapshotProvider(),
        adapter=adapter,
    )

    summary = replay_service.run_historical_range(
        start_datetime=datetime(2026, 1, 5, 0, 0),
        end_datetime=datetime(2026, 1, 5, 23, 59),
        timeframe="1d+30m",
        market="CN",
    )

    assert summary["status"] == "completed"
    assert adapter.candidate_calls[0]["analysis_timeframe"] == "1d+30m"
