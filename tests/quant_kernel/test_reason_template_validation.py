from __future__ import annotations

from copy import deepcopy

import pytest

from app.quant_kernel.config import STRATEGY_SCORING_CONFIG, StrategyScoringConfig


def test_unknown_reason_template_placeholder_is_rejected() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    payload["base"]["technical"]["scorers"]["ma_slope"]["reason_template"] = "value={unknown_field}"
    strategy = StrategyScoringConfig(schema_version="quant_explain/v2.3", base=payload["base"], profiles=payload["profiles"])
    with pytest.raises(ValueError):
        strategy.resolve()


def test_known_reason_template_placeholder_passes() -> None:
    payload = deepcopy(STRATEGY_SCORING_CONFIG)
    payload["base"]["technical"]["scorers"]["ma_slope"]["reason_template"] = "ma20_slope={ma20_slope}, score={score}"
    strategy = StrategyScoringConfig(schema_version="quant_explain/v2.3", base=payload["base"], profiles=payload["profiles"])
    resolved = strategy.resolve()
    assert "ma_slope" in resolved["technical"]["scorers"]

