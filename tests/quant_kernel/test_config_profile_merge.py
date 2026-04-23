from __future__ import annotations

from copy import deepcopy

import pytest

from app.quant_kernel.config import (
    CONTEXT_DIMENSIONS,
    STRATEGY_SCORING_CONFIG,
    TECHNICAL_DIMENSIONS,
    QuantKernelConfig,
    StrategyScoringConfig,
)


def test_default_strategy_scoring_mode_is_rule_only() -> None:
    config = QuantKernelConfig.default()
    resolved = config.resolve_strategy_scoring()
    assert resolved["dual_track"]["mode"] == "rule_only"
    assert resolved["dual_track"]["track_weights"]["tech"] == 1.0
    assert resolved["dual_track"]["track_weights"]["context"] == 1.0


def test_candidate_profile_override_merges_group_and_dual_track_settings() -> None:
    config = QuantKernelConfig.default()
    resolved = config.resolve_strategy_scoring("candidate")
    assert resolved["technical"]["group_weights"]["trend"] == 1.3
    assert resolved["technical"]["group_weights"]["volatility_risk"] == 0.8
    assert resolved["dual_track"]["fusion_buy_threshold"] == 0.78
    assert resolved["dual_track"]["sell_precedence_gate"] == -0.52
    assert resolved["dual_track"]["mode"] == "rule_only"
    assert resolved["context"]["group_weights"]["market_structure"] == 1.4


def test_position_profile_override_merges_context_and_dimension_weights() -> None:
    config = QuantKernelConfig.default()
    resolved = config.resolve_strategy_scoring("position")
    assert resolved["technical"]["group_weights"]["volatility_risk"] == 1.5
    assert resolved["technical"]["dimension_weights"]["atr_risk"] == 1.5
    assert resolved["context"]["group_weights"]["risk_account"] == 1.5
    assert resolved["context"]["dimension_weights"]["execution_feedback"] == 1.1
    assert resolved["dual_track"]["fusion_buy_threshold"] == 0.72


def test_all_dimensions_have_scorers_and_reason_templates() -> None:
    config = QuantKernelConfig.default()
    resolved = config.resolve_strategy_scoring()
    technical_scorers = resolved["technical"]["scorers"]
    context_scorers = resolved["context"]["scorers"]
    for dimension in TECHNICAL_DIMENSIONS:
        scorer = technical_scorers[dimension]
        assert isinstance(scorer["algorithm"], str) and scorer["algorithm"]
        assert isinstance(scorer["params"], dict)
        assert isinstance(scorer["reason_template"], str) and scorer["reason_template"]
    for dimension in CONTEXT_DIMENSIONS:
        scorer = context_scorers[dimension]
        assert isinstance(scorer["algorithm"], str) and scorer["algorithm"]
        assert isinstance(scorer["params"], dict)
        assert isinstance(scorer["reason_template"], str) and scorer["reason_template"]


def test_invalid_profile_name_raises_value_error() -> None:
    config = QuantKernelConfig.default()
    with pytest.raises(ValueError):
        config.resolve_strategy_scoring("unknown")


def test_volatility_mode_sell_precedence_validation_is_enforced() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    payload["base"]["dual_track"]["threshold_mode"] = "volatility_adjusted"
    payload["base"]["dual_track"]["fusion_sell_threshold"] = -0.17
    payload["base"]["dual_track"]["sell_vol_k"] = 0.20
    payload["base"]["dual_track"]["sell_precedence_gate"] = -0.30
    strategy = StrategyScoringConfig(schema_version="quant_explain/v2.3", base=payload["base"], profiles=payload["profiles"])
    with pytest.raises(ValueError):
        strategy.resolve()
