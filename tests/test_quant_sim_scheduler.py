from quant_sim.candidate_pool_service import CandidatePoolService
from quant_sim.portfolio_service import PortfolioService
from quant_sim.signal_center_service import SignalCenterService
from quant_sim.scheduler import QuantSimScheduler


def test_scheduler_run_once_scans_candidates_and_creates_signals(tmp_path, monkeypatch):
    candidate_service = CandidatePoolService(db_file=tmp_path / "quant_sim.db")
    candidate_service.add_manual_candidate("600000", "浦发银行", "main_force")
    candidate_service.add_manual_candidate("000001", "平安银行", "profit_growth")

    scheduler = QuantSimScheduler(db_file=tmp_path / "quant_sim.db")

    def fake_analyze(candidate, market_snapshot=None):
        if candidate["stock_code"] == "600000":
            return {
                "action": "BUY",
                "confidence": 81,
                "reasoning": "趋势修复",
                "position_size_pct": 20,
            }
        return {
            "action": "HOLD",
            "confidence": 60,
            "reasoning": "继续观察",
            "position_size_pct": 0,
        }

    monkeypatch.setattr(scheduler.engine.adapter, "analyze_candidate", fake_analyze)

    result = scheduler.run_once()

    assert result["candidates_scanned"] == 2
    assert result["signals_created"] == 2
    assert result["positions_checked"] == 0


def test_scheduler_tracks_positions_and_generates_followup_signals(tmp_path, monkeypatch):
    candidate_service = CandidatePoolService(db_file=tmp_path / "quant_sim.db")
    signal_service = SignalCenterService(db_file=tmp_path / "quant_sim.db")
    portfolio_service = PortfolioService(db_file=tmp_path / "quant_sim.db")
    candidate_service.add_manual_candidate("600000", "浦发银行", "main_force")
    candidate = candidate_service.list_candidates()[0]
    buy_signal = signal_service.create_signal(
        candidate,
        {"action": "BUY", "confidence": 81, "reasoning": "建仓", "position_size_pct": 20},
    )
    portfolio_service.confirm_buy(
        buy_signal["id"],
        price=10.2,
        quantity=100,
        note="已买入",
        executed_at="2026-04-07 10:00:00",
    )

    scheduler = QuantSimScheduler(db_file=tmp_path / "quant_sim.db")

    monkeypatch.setattr(
        scheduler.engine.adapter,
        "analyze_position",
        lambda candidate, position, market_snapshot=None: {
            "action": "SELL",
            "confidence": 74,
            "reasoning": "走弱退出",
            "position_size_pct": 0,
            "decision_type": "dual_track_divergence",
            "tech_score": -0.32,
            "context_score": 0.1,
        },
    )

    result = scheduler.run_once()
    signals = signal_service.list_signals(stock_code="600000")

    assert result["positions_checked"] == 1
    assert result["candidates_scanned"] == 0
    assert result["signals_created"] == 1
    assert signals[0]["action"] == "SELL"
    assert signals[0]["status"] == "pending"
