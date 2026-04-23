from __future__ import annotations

from copy import deepcopy

import pytest

from app.quant_kernel.config import STRATEGY_SCORING_CONFIG, StrategyScoringConfig


def _resolve(payload: dict) -> None:
    strategy = StrategyScoringConfig(schema_version="quant_explain/v2.3", base=payload["base"], profiles=payload["profiles"])
    strategy.resolve()


def test_invalid_mode_rejected() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    payload["base"]["dual_track"]["mode"] = "invalid"
    with pytest.raises(ValueError):
        _resolve(payload)


def test_track_weight_denominator_must_be_positive() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    payload["base"]["dual_track"]["track_weights"] = {"tech": 0.0, "context": 0.0}
    with pytest.raises(ValueError):
        _resolve(payload)


def test_weighted_or_hybrid_reject_uniform_group_weights() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    payload["base"]["dual_track"]["mode"] = "weighted_only"
    with pytest.raises(ValueError):
        _resolve(payload)


def test_weighted_or_hybrid_reject_source_execution_higher_than_risk_account() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    payload["base"]["dual_track"]["mode"] = "weighted_only"
    payload["base"]["context"]["group_weights"] = {
        "market_structure": 1.4,
        "risk_account": 0.8,
        "tradability_timing": 0.7,
        "source_execution": 1.0,
    }
    payload["base"]["technical"]["group_weights"] = {
        "trend": 1.3,
        "momentum": 1.2,
        "volume_confirmation": 0.9,
        "volatility_risk": 0.8,
    }
    with pytest.raises(ValueError):
        _resolve(payload)

