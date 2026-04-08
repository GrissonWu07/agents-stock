from datetime import date, datetime

from quant_sim.stockpolicy_core import DualTrackDecisionEngine, LotStatus, PositionLot


def test_position_lot_follows_t_plus_one_availability():
    lot = PositionLot(
        lot_id="lot-1",
        entry_time=datetime(2026, 4, 8, 10, 0, 0),
        entry_date=date(2026, 4, 8),
        original_quantity=100,
        remaining_quantity=100,
        entry_price=10.2,
        status=LotStatus.LOCKED,
        unlock_date=date(2026, 4, 9),
    )

    assert lot.is_available(date(2026, 4, 8)) is False
    assert lot.is_available(date(2026, 4, 9)) is True


def test_dual_track_decision_engine_returns_resonance_buy():
    engine = DualTrackDecisionEngine()

    decision = engine.resolve(
        code="600000",
        price=10.2,
        tech_score=0.62,
        context_score=0.31,
        timestamp=datetime(2026, 4, 8, 10, 0, 0),
        reason="量价与来源共振",
    )

    assert decision.action == "BUY"
    assert decision.decision_type == "dual_track_resonance"
    assert decision.position_ratio == 0.6
