from __future__ import annotations

from datetime import datetime

from app.quant_kernel.runtime import KernelStrategyRuntime


def test_execution_feedback_score_is_capped_at_dimension_stage() -> None:
    runtime = KernelStrategyRuntime()
    decision = runtime.evaluate_candidate(
        candidate={
            "stock_code": "600000",
            "stock_name": "浦发银行",
            "source": "main_force",
            "sources": ["main_force"],
        },
        market_snapshot={
            "current_price": 12.2,
            "ma5": 12.0,
            "ma10": 11.8,
            "ma20": 11.5,
            "ma60": 10.9,
            "macd": 0.3,
            "rsi12": 57.0,
            "volume_ratio": 1.3,
            "trend": "up",
            "execution_feedback_score": 0.9,
            "feedback_sample_count": 12,
        },
        current_time=datetime(2026, 4, 22, 14, 30, 0),
    )
    explain = ((decision.strategy_profile or {}).get("explainability") or {}).get("context_breakdown") or {}
    dims = explain.get("dimensions") or []
    execution_feedback = next(item for item in dims if item.get("id") == "execution_feedback")
    assert execution_feedback["score"] == 0.25

