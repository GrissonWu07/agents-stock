from datetime import datetime, timedelta

from app.quant_sim.dynamic_strategy import DynamicStrategyController


class _MissingMarketSectorDB:
    def get_latest_raw_data(self, key, within_hours=None):
        del key, within_hours
        return None


def test_market_component_ignores_stale_flow_snapshot(tmp_path, monkeypatch):
    controller = DynamicStrategyController(db_file=tmp_path / "app.quant_sim.db")
    stale_time = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S")

    monkeypatch.setattr(controller, "_sector_db_instance", lambda: _MissingMarketSectorDB())
    monkeypatch.setattr(
        "app.quant_sim.dynamic_strategy.news_flow_db.get_latest_snapshot",
        lambda: {
            "total_score": 65,
            "fetch_time": stale_time,
        },
    )

    component = controller._market_component(lookback_hours=48)  # noqa: SLF001 - targeted regression coverage

    assert component is None


def test_resolve_binding_keeps_base_template_without_enough_switch_evidence(tmp_path, monkeypatch):
    controller = DynamicStrategyController(db_file=tmp_path / "app.quant_sim.db")
    base_binding = controller.db.resolve_strategy_profile_binding("aggressive_v23")

    monkeypatch.setattr(
        controller,
        "_build_dynamic_signal",
        lambda **kwargs: {  # noqa: ARG005 - test seam
            "score": -0.36,
            "confidence": 0.52,
            "components": [
                {
                    "key": "market",
                    "weight": 0.35,
                    "score": -0.36,
                    "confidence": 0.52,
                    "fresh": True,
                }
            ],
        },
    )

    binding = controller.resolve_binding(
        base_binding=base_binding,
        stock_code="002463",
        stock_name="沪电股份",
        ai_dynamic_strategy="hybrid",
        ai_dynamic_strength=0.5,
        ai_dynamic_lookback=48,
    )

    dynamic = binding["dynamic_strategy"]

    assert binding["profile_id"] == "aggressive_v23"
    assert dynamic["recommended_template_variant"] == "conservative"
    assert dynamic["applied_template_variant"] == "aggressive"
    assert dynamic["template_switch_applied"] is False
    assert dynamic["template_switch_reason"] == "insufficient_evidence"


def test_resolve_binding_switches_template_when_fresh_multi_source_evidence_is_strong(tmp_path, monkeypatch):
    controller = DynamicStrategyController(db_file=tmp_path / "app.quant_sim.db")
    base_binding = controller.db.resolve_strategy_profile_binding("aggressive_v23")

    monkeypatch.setattr(
        controller,
        "_build_dynamic_signal",
        lambda **kwargs: {  # noqa: ARG005 - test seam
            "score": -0.54,
            "confidence": 0.82,
            "components": [
                {
                    "key": "market",
                    "weight": 0.35,
                    "score": -0.82,
                    "confidence": 0.75,
                    "fresh": True,
                },
                {
                    "key": "ai",
                    "weight": 0.25,
                    "score": -0.61,
                    "confidence": 0.92,
                    "fresh": True,
                },
            ],
        },
    )

    binding = controller.resolve_binding(
        base_binding=base_binding,
        stock_code="002463",
        stock_name="沪电股份",
        ai_dynamic_strategy="hybrid",
        ai_dynamic_strength=0.5,
        ai_dynamic_lookback=48,
    )

    dynamic = binding["dynamic_strategy"]

    assert binding["profile_id"] == "conservative_v23"
    assert dynamic["recommended_template_variant"] == "conservative"
    assert dynamic["applied_template_variant"] == "conservative"
    assert dynamic["template_switch_applied"] is True
    assert dynamic["template_switch_reason"] == "strong_opposite_signal"
