from app.quant_sim.candidate_pool_service import CandidatePoolService
from app.quant_sim.engine import QuantSimEngine
from app.quant_kernel.models import Decision


def test_engine_generates_pending_buy_signal_for_candidate(tmp_path, monkeypatch):
    candidate_service = CandidatePoolService(db_file=tmp_path / "app.quant_sim.db")
    candidate_service.add_manual_candidate(
        stock_code="600000",
        stock_name="浦发银行",
        source="main_force",
    )
    candidate = candidate_service.list_candidates()[0]

    engine = QuantSimEngine(db_file=tmp_path / "app.quant_sim.db")
    captured = {}

    def fake_analyze_candidate(payload, market_snapshot=None, analysis_timeframe="1d"):
        captured["analysis_timeframe"] = analysis_timeframe
        return {
            "action": "BUY",
            "confidence": 82,
            "reasoning": "趋势确认",
            "position_size_pct": 20,
        }

    monkeypatch.setattr(engine.adapter, "analyze_candidate", fake_analyze_candidate)

    signal = engine.analyze_candidate(candidate)
    signals = engine.signal_center.list_signals(stock_code="600000")

    assert signal["action"] == "BUY"
    assert signal["status"] == "pending"
    assert signals[0]["confidence"] == 82
    assert captured["analysis_timeframe"] == "1d"


def test_engine_records_hold_as_observed_signal(tmp_path, monkeypatch):
    candidate_service = CandidatePoolService(db_file=tmp_path / "app.quant_sim.db")
    candidate_service.add_manual_candidate(
        stock_code="000001",
        stock_name="平安银行",
        source="value_stock",
    )
    candidate = candidate_service.list_candidates()[0]

    engine = QuantSimEngine(db_file=tmp_path / "app.quant_sim.db")
    monkeypatch.setattr(
        engine.adapter,
        "analyze_candidate",
        lambda payload, market_snapshot=None, analysis_timeframe="1d": {
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
    candidate_service = CandidatePoolService(db_file=tmp_path / "app.quant_sim.db")
    candidate_service.add_manual_candidate(
        stock_code="601318",
        stock_name="中国平安",
        source="main_force",
    )
    candidate = candidate_service.list_candidates()[0]

    engine = QuantSimEngine(db_file=tmp_path / "app.quant_sim.db")
    monkeypatch.setattr(
        engine.adapter,
        "analyze_candidate",
        lambda payload, market_snapshot=None, analysis_timeframe="1d": Decision(
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
            strategy_profile={"analysis_timeframe": {"key": analysis_timeframe}},
        ),
    )

    signal = engine.analyze_candidate(candidate)

    assert signal["decision_type"] == "dual_track_resonance"
    assert signal["tech_score"] == 0.62
    assert signal["context_score"] == 0.31
    assert signal["position_size_pct"] == 60.0
    assert signal["strategy_profile"]["analysis_timeframe"]["key"] == "1d"
