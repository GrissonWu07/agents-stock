"""Core decision models reused across simulation and future live execution."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional


@dataclass
class Decision:
    code: str
    action: str
    confidence: float
    price: float
    timestamp: datetime
    reason: str
    agent_votes: Optional[Dict[str, object]] = None
    tech_score: float = 0.0
    context_score: float = 0.0
    position_ratio: float = 0.0
    decision_type: str = "single_track"
    dual_track_details: Optional[Dict[str, object]] = None
    strategy_profile: Optional[Dict[str, object]] = None


@dataclass
class ContextualScore:
    score: float
    signal: str
    confidence: float
    components: Dict[str, Dict]
    reason: str
