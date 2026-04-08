"""Signal creation and listing helpers."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from quant_sim.db import DEFAULT_DB_FILE, QuantSimDB
from quant_sim.stockpolicy_core import Decision


class SignalCenterService:
    """Normalizes strategy decisions into persisted signals."""

    def __init__(self, db_file: str | Path = DEFAULT_DB_FILE):
        self.db = QuantSimDB(db_file)

    def create_signal(self, candidate: dict[str, Any], decision: dict[str, Any] | Decision) -> dict[str, Any]:
        payload = self._normalize_decision_payload(decision)
        action = str(payload.get("action", "HOLD")).upper()
        status = "pending" if action in {"BUY", "SELL"} else "observed"
        signal_id = self.db.add_signal(
            {
                "candidate_id": candidate.get("id"),
                "stock_code": candidate["stock_code"],
                "stock_name": candidate.get("stock_name"),
                "action": action,
                "confidence": int(payload.get("confidence", 0)),
                "reasoning": payload.get("reasoning", ""),
                "position_size_pct": float(payload.get("position_size_pct", 0)),
                "stop_loss_pct": float(payload.get("stop_loss_pct", 5)),
                "take_profit_pct": float(payload.get("take_profit_pct", 12)),
                "decision_type": payload.get("decision_type"),
                "tech_score": float(payload.get("tech_score", 0)),
                "context_score": float(payload.get("context_score", 0)),
                "status": status,
            }
        )
        return self.db.get_signals(stock_code=candidate["stock_code"], limit=1)[0]

    def list_pending_signals(self) -> list[dict[str, Any]]:
        return self.db.get_pending_signals()

    def list_signals(self, stock_code: Optional[str] = None, limit: int = 100) -> list[dict[str, Any]]:
        return self.db.get_signals(stock_code=stock_code, limit=limit)

    @staticmethod
    def _normalize_decision_payload(decision: dict[str, Any] | Decision) -> dict[str, Any]:
        if isinstance(decision, Decision):
            confidence = decision.confidence * 100 if decision.confidence <= 1 else decision.confidence
            return {
                "action": decision.action,
                "confidence": round(confidence),
                "reasoning": decision.reason,
                "position_size_pct": round(decision.position_ratio * 100, 2),
                "stop_loss_pct": 5,
                "take_profit_pct": 12,
                "decision_type": decision.decision_type,
                "tech_score": decision.tech_score,
                "context_score": decision.context_score,
            }

        position_size = decision.get("position_size_pct")
        if position_size is None and "position_ratio" in decision:
            position_size = float(decision.get("position_ratio", 0)) * 100
        return {
            "action": decision.get("action", "HOLD"),
            "confidence": decision.get("confidence", 0),
            "reasoning": decision.get("reasoning", decision.get("reason", "")),
            "position_size_pct": position_size or 0,
            "stop_loss_pct": decision.get("stop_loss_pct", 5),
            "take_profit_pct": decision.get("take_profit_pct", 12),
            "decision_type": decision.get("decision_type"),
            "tech_score": decision.get("tech_score", 0),
            "context_score": decision.get("context_score", 0),
        }
