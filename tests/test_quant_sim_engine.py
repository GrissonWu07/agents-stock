from quant_sim.candidate_pool_service import CandidatePoolService
from quant_sim.engine import QuantSimEngine
from quant_sim.stockpolicy_core import Decision


def test_engine_generates_pending_buy_signal_for_candidate(tmp_path, monkeypatch):
    candidate_service = CandidatePoolService(db_file=tmp_path / "quant_sim.db")
    candidate_service.add_manual_candidate(
        stock_code="600000",
        stock_name="浦发银行",
        source="main_force",
    )
    candidate = candidate_service.list_candidates()[0]

    engine = QuantSimEngine(db_file=tmp_path / "quant_sim.db")
    monkeypatch.setattr(
        engine.adapter,
        "analyze_candidate",
        lambda payload, market_snapshot=None: {
            "action": "BUY",
            "confidence": 82,
            "reasoning": "趋势确认",
            "position_size_pct": 20,
        },
    )

    signal = engine.analyze_candidate(candidate)
    signals = engine.signal_center.list_signals(stock_code="600000")

    assert signal["action"] == "BUY"
    assert signal["status"] == "pending"
    assert signals[0]["confidence"] == 82


def test_engine_records_hold_as_observed_signal(tmp_path, monkeypatch):
    candidate_service = CandidatePoolService(db_file=tmp_path / "quant_sim.db")
    candidate_service.add_manual_candidate(
        stock_code="000001",
        stock_name="平安银行",
        source="value_stock",
    )
    candidate = candidate_service.list_candidates()[0]

    engine = QuantSimEngine(db_file=tmp_path / "quant_sim.db")
    monkeypatch.setattr(
        engine.adapter,
        "analyze_candidate",
        lambda payload, market_snapshot=None: {
            "action": "HOLD",
            "confidence": 61,
            "reasoning": "等待确认",
            "position_size_pct": 0,
        },
    )

    signal = engine.analyze_candidate(candidate)

    assert signal["action"] == "HOLD"
    assert signal["status"] == "observed"


def test_engine_uses_embedded_stockpolicy_dual_track_decision(tmp_path, monkeypatch):
    candidate_service = CandidatePoolService(db_file=tmp_path / "quant_sim.db")
    candidate_service.add_manual_candidate(
        stock_code="601318",
        stock_name="中国平安",
        source="main_force",
    )
    candidate = candidate_service.list_candidates()[0]

    engine = QuantSimEngine(db_file=tmp_path / "quant_sim.db")
    monkeypatch.setattr(
        engine.adapter,
        "analyze_candidate",
        lambda payload, market_snapshot=None: Decision(
            code=payload["stock_code"],
            action="BUY",
            confidence=0.86,
            price=52.3,
            timestamp=engine.adapter.now(),
            reason="双轨共振",
            tech_score=0.62,
            context_score=0.31,
            position_ratio=0.6,
            decision_type="dual_track_resonance",
        ),
    )

    signal = engine.analyze_candidate(candidate)

    assert signal["decision_type"] == "dual_track_resonance"
    assert signal["tech_score"] == 0.62
    assert signal["context_score"] == 0.31
    assert signal["position_size_pct"] == 60.0
