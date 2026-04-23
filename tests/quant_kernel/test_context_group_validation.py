from __future__ import annotations

from copy import deepcopy

import pytest

from app.quant_kernel.config import CONTEXT_GROUP_DIMENSIONS, STRATEGY_SCORING_CONFIG, StrategyScoringConfig


def _strategy_with(payload: dict) -> StrategyScoringConfig:
    return StrategyScoringConfig(schema_version="quant_explain/v2.3", base=payload["base"], profiles=payload["profiles"])


def test_context_groups_must_be_total_and_disjoint() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    payload["base"]["context"]["dimension_groups"]["market_structure"] = ["trend_regime", "price_structure"]
    with pytest.raises(ValueError):
        _strategy_with(payload).resolve()


def test_context_group_positive_weight_requires_positive_dimension_weight() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    group = "risk_account"
    for dimension in CONTEXT_GROUP_DIMENSIONS[group]:
        payload["base"]["context"]["dimension_weights"][dimension] = 0.0
    with pytest.raises(ValueError):
        _strategy_with(payload).resolve()


def test_context_unknown_group_rejected() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    payload["base"]["context"]["group_weights"]["unknown_group"] = 1.0
    with pytest.raises(ValueError):
        _strategy_with(payload).resolve()

