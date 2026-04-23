from __future__ import annotations

from copy import deepcopy

import pytest

from app.quant_kernel.config import STRATEGY_SCORING_CONFIG, StrategyScoringConfig


def test_sell_precedence_validation_in_static_mode() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    payload["base"]["dual_track"]["threshold_mode"] = "static"
    payload["base"]["dual_track"]["fusion_sell_threshold"] = -0.20
    payload["base"]["dual_track"]["sell_precedence_gate"] = -0.10
    strategy = StrategyScoringConfig(schema_version="quant_explain/v2.3", base=payload["base"], profiles=payload["profiles"])
    with pytest.raises(ValueError):
        strategy.resolve()


def test_sell_precedence_validation_in_volatility_mode() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    payload["base"]["dual_track"]["threshold_mode"] = "volatility_adjusted"
    payload["base"]["dual_track"]["fusion_sell_threshold"] = -0.17
    payload["base"]["dual_track"]["sell_vol_k"] = 0.20
    payload["base"]["dual_track"]["sell_precedence_gate"] = -0.30
    strategy = StrategyScoringConfig(schema_version="quant_explain/v2.3", base=payload["base"], profiles=payload["profiles"])
    with pytest.raises(ValueError):
        strategy.resolve()
