from __future__ import annotations

from app.quant_kernel.decision_engine import resolve_v23_final_action


def test_weak_weighted_sell_cannot_override_hold_or_buy() -> None:
    resolved_hold = resolve_v23_final_action(
        mode="hybrid",
        core_rule_action="HOLD",
        weighted_action_raw="SELL",
        fusion_score=-0.21,
        sell_precedence_gate=-0.50,
        vetoes=[],
    )
    resolved_buy = resolve_v23_final_action(
        mode="hybrid",
        core_rule_action="BUY",
        weighted_action_raw="SELL",
        fusion_score=-0.30,
        sell_precedence_gate=-0.50,
        vetoes=[],
    )
    assert resolved_hold["final_action"] == "HOLD"
    assert resolved_buy["final_action"] == "HOLD"


def test_strong_weighted_sell_overrides_when_below_sell_precedence_gate() -> None:
    resolved = resolve_v23_final_action(
        mode="hybrid",
        core_rule_action="HOLD",
        weighted_action_raw="SELL",
        fusion_score=-0.65,
        sell_precedence_gate=-0.50,
        vetoes=[],
    )
    assert resolved["final_action"] == "SELL"
    assert resolved["matched_branch"] == "hybrid_weighted_sell_precedence"

