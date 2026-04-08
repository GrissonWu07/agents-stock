"""Embedded stockpolicy core primitives reused by quant simulation.

This module intentionally vendors the essential stockpolicy concepts into the
main project so the Streamlit workflow can own strategy and ledger behavior
without depending on the standalone stockpolicy repo at runtime.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum
from typing import Optional


@dataclass
class Decision:
    """Stockpolicy-style dual-track trading decision."""

    code: str
    action: str
    confidence: float
    price: float
    timestamp: datetime
    reason: str
    tech_score: float = 0.0
    context_score: float = 0.0
    position_ratio: float = 0.0
    decision_type: str = "single_track"


class LotStatus(Enum):
    """Lot status copied from stockpolicy's T+1 ledger model."""

    LOCKED = "LOCKED"
    AVAILABLE = "AVAILABLE"
    CLOSED = "CLOSED"


@dataclass
class PositionLot:
    """Single buy lot with T+1 availability checks."""

    lot_id: str
    entry_time: datetime
    entry_date: date
    original_quantity: int
    remaining_quantity: int
    entry_price: float
    status: LotStatus
    unlock_date: date

    def is_available(self, current_date: date) -> bool:
        if self.remaining_quantity <= 0:
            return False
        if self.status == LotStatus.CLOSED:
            return False
        if self.status == LotStatus.AVAILABLE:
            return True
        return current_date >= self.unlock_date and current_date > self.entry_date

    def consume(self, quantity: int) -> int:
        consumed = min(quantity, self.remaining_quantity)
        self.remaining_quantity -= consumed
        if self.remaining_quantity == 0:
            self.status = LotStatus.CLOSED
        return consumed


class DualTrackDecisionEngine:
    """Lightweight embedded resolver based on stockpolicy dual-track semantics."""

    def resolve(
        self,
        code: str,
        price: float,
        tech_score: float,
        context_score: float,
        timestamp: datetime,
        reason: str,
    ) -> Decision:
        if tech_score >= 0.75 and context_score >= 0.45:
            action = "BUY"
            position_ratio = 1.0
            decision_type = "dual_track_resonance"
        elif tech_score >= 0.55 and context_score >= 0.25:
            action = "BUY"
            position_ratio = 0.6
            decision_type = "dual_track_resonance"
        elif tech_score <= -0.2 and context_score <= -0.05:
            action = "SELL"
            position_ratio = 0.0
            decision_type = "context_veto"
        elif tech_score <= -0.15:
            action = "SELL"
            position_ratio = 0.0
            decision_type = "dual_track_divergence"
        else:
            action = "HOLD"
            position_ratio = 0.0
            decision_type = "single_track"

        confidence = min(0.95, 0.55 + abs(tech_score) * 0.25 + max(context_score, 0) * 0.2)
        return Decision(
            code=code,
            action=action,
            confidence=confidence,
            price=price,
            timestamp=timestamp,
            reason=reason,
            tech_score=round(tech_score, 4),
            context_score=round(context_score, 4),
            position_ratio=round(position_ratio, 4),
            decision_type=decision_type,
        )
