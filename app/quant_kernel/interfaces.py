"""Provider interfaces for future kernel runtimes."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol, runtime_checkable, Any


@runtime_checkable
class MarketDataProvider(Protocol):
    def get_comprehensive_data(self, stock_code: str) -> dict[str, Any] | None: ...


@runtime_checkable
class ModelProvider(Protocol):
    def analyze(self, prompt: str) -> dict[str, Any]: ...


@runtime_checkable
class ExecutionProvider(Protocol):
    def execute(self, decision: Any) -> dict[str, Any]: ...


@runtime_checkable
class ContextProvider(Protocol):
    def score_context(
        self,
        *,
        sources: list[str],
        market_snapshot: dict[str, Any] | None,
        current_time: datetime,
        candidate: dict[str, Any] | None = None,
        position: dict[str, Any] | None = None,
    ) -> dict[str, Any]: ...
