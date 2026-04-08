"""Thin scheduler for one-pass quant simulation analysis."""

from __future__ import annotations

from pathlib import Path

from quant_sim.db import DEFAULT_DB_FILE
from quant_sim.engine import QuantSimEngine
from quant_sim.portfolio_service import PortfolioService


class QuantSimScheduler:
    """Run one deterministic refresh cycle for the quant simulation workspace."""

    def __init__(self, db_file: str | Path = DEFAULT_DB_FILE):
        self.db_file = db_file
        self.engine = QuantSimEngine(db_file=db_file)
        self.portfolio = PortfolioService(db_file=db_file)

    def run_once(self) -> dict[str, int]:
        candidates = self.engine.candidate_pool.list_candidates(status="active")
        positions = self.portfolio.list_positions()
        candidate_signals = self.engine.analyze_active_candidates()
        position_signals = self.engine.analyze_positions()
        return {
            "candidates_scanned": len(candidates),
            "signals_created": len(candidate_signals) + len(position_signals),
            "positions_checked": len(positions),
        }
