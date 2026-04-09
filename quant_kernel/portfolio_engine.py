"""Reusable ledger primitives extracted from stockpolicy for simulation and live reuse."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum


class LotStatus(Enum):
    """Status for a single buy lot under A-share T+1 rules."""

    LOCKED = "LOCKED"
    AVAILABLE = "AVAILABLE"
    CLOSED = "CLOSED"


@dataclass
class PositionLot:
    """Single buy lot tracked independently for T+1 availability and FIFO selling."""

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

    def is_locked(self, current_date: date) -> bool:
        return not self.is_available(current_date)

    def consume(self, quantity: int) -> int:
        consumed = min(quantity, self.remaining_quantity)
        self.remaining_quantity -= consumed
        if self.remaining_quantity == 0:
            self.status = LotStatus.CLOSED
        return consumed
