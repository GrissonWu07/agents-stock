"""Embedded stockpolicy strategy adapter built on the main project's data stack."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from smart_monitor_tdx_data import SmartMonitorTDXDataFetcher
from quant_sim.stockpolicy_core import Decision, DualTrackDecisionEngine


SOURCE_CONTEXT_SCORES = {
    "main_force": 0.28,
    "profit_growth": 0.22,
    "low_price_bull": 0.18,
    "value_stock": 0.2,
    "manual": 0.12,
}


class StockPolicyAdapter:
    """Generate semi-auto decisions from unified market data and selector context."""

    def __init__(self, data_fetcher: Optional[SmartMonitorTDXDataFetcher] = None):
        self.data_fetcher = data_fetcher or SmartMonitorTDXDataFetcher()
        self.decision_engine = DualTrackDecisionEngine()

    @staticmethod
    def now() -> datetime:
        return datetime.now()

    def analyze_candidate(
        self,
        candidate: dict[str, Any],
        market_snapshot: Optional[dict[str, Any]] = None,
    ) -> Decision:
        stock_code = candidate["stock_code"]
        sources = candidate.get("sources") or [candidate.get("source", "manual")]

        snapshot = market_snapshot or self.data_fetcher.get_comprehensive_data(stock_code)
        if not snapshot:
            return self.decision_engine.resolve(
                code=stock_code,
                price=float(candidate.get("latest_price") or 0),
                tech_score=0.0,
                context_score=self._calculate_context_score(sources),
                timestamp=self.now(),
                reason="暂未取得完整行情与技术指标，保持观察。",
            )

        current_price = float(snapshot.get("current_price") or candidate.get("latest_price") or 0)
        ma5 = float(snapshot.get("ma5") or 0)
        ma20 = float(snapshot.get("ma20") or 0)
        ma60 = float(snapshot.get("ma60") or 0)
        macd = float(snapshot.get("macd") or 0)
        rsi12 = float(snapshot.get("rsi12") or 50)
        volume_ratio = float(snapshot.get("volume_ratio") or 1)
        trend = snapshot.get("trend", "sideways")

        tech_score = self._calculate_tech_score(
            current_price=current_price,
            ma5=ma5,
            ma20=ma20,
            ma60=ma60,
            macd=macd,
            rsi12=rsi12,
            volume_ratio=volume_ratio,
            trend=trend,
        )
        context_score = self._calculate_context_score(sources)
        reasoning = self._build_reasoning(
            candidate=candidate,
            current_price=current_price,
            ma5=ma5,
            ma20=ma20,
            ma60=ma60,
            macd=macd,
            rsi12=rsi12,
            volume_ratio=volume_ratio,
            tech_score=tech_score,
            context_score=context_score,
        )
        return self.decision_engine.resolve(
            code=stock_code,
            price=current_price,
            tech_score=tech_score,
            context_score=context_score,
            timestamp=self.now(),
            reason=reasoning,
        )

    def analyze_position(
        self,
        candidate: dict[str, Any],
        position: dict[str, Any],
        market_snapshot: Optional[dict[str, Any]] = None,
    ) -> Decision:
        snapshot = market_snapshot or self.data_fetcher.get_comprehensive_data(position["stock_code"])
        if not snapshot:
            return self.decision_engine.resolve(
                code=position["stock_code"],
                price=float(position.get("latest_price") or position.get("avg_price") or 0),
                tech_score=0.0,
                context_score=self._calculate_context_score(candidate.get("sources") or [candidate.get("source", "manual")]),
                timestamp=self.now(),
                reason="持仓跟踪未取得完整行情，继续观察。",
            )

        current_price = float(snapshot.get("current_price") or position.get("latest_price") or position.get("avg_price") or 0)
        ma20 = float(snapshot.get("ma20") or 0)
        macd = float(snapshot.get("macd") or 0)
        rsi12 = float(snapshot.get("rsi12") or 50)
        avg_price = float(position.get("avg_price") or 0)
        pnl_pct = ((current_price - avg_price) / avg_price * 100) if avg_price > 0 else 0.0

        tech_score = 0.0
        if current_price < ma20 and ma20 > 0:
            tech_score -= 0.25
        if macd < 0:
            tech_score -= 0.2
        if pnl_pct <= -5:
            tech_score -= 0.35
        elif pnl_pct >= 10:
            tech_score -= 0.15
        elif pnl_pct >= 2 and macd > 0:
            tech_score += 0.08
        if rsi12 >= 75:
            tech_score -= 0.12

        context_score = self._calculate_context_score(candidate.get("sources") or [candidate.get("source", "manual")])
        reason = (
            f"{position['stock_code']} 持仓跟踪：现价 {current_price:.2f}，成本 {avg_price:.2f}，"
            f"浮盈亏 {pnl_pct:.2f}% ，MA20 {ma20:.2f}，MACD {macd:.3f}，RSI12 {rsi12:.2f}。"
        )
        return self.decision_engine.resolve(
            code=position["stock_code"],
            price=current_price,
            tech_score=tech_score,
            context_score=context_score,
            timestamp=self.now(),
            reason=reason,
        )

    @staticmethod
    def _calculate_context_score(sources: list[str]) -> float:
        values = [SOURCE_CONTEXT_SCORES.get(source, 0.1) for source in sources if source]
        if not values:
            return 0.1
        return round(sum(values) / len(values), 4)

    @staticmethod
    def _calculate_tech_score(
        current_price: float,
        ma5: float,
        ma20: float,
        ma60: float,
        macd: float,
        rsi12: float,
        volume_ratio: float,
        trend: str,
    ) -> float:
        score = 0.0

        if trend == "up":
            score += 0.35
        elif trend == "down":
            score -= 0.35

        if current_price > ma5 > ma20 > ma60 > 0:
            score += 0.25
        elif current_price < ma5 < ma20 < ma60 and ma60 > 0:
            score -= 0.25

        if macd > 0:
            score += 0.15
        elif macd < 0:
            score -= 0.15

        if 45 <= rsi12 <= 68:
            score += 0.1
        elif rsi12 >= 75:
            score -= 0.12
        elif rsi12 <= 25:
            score += 0.08

        if volume_ratio >= 1.2:
            score += 0.08
        elif volume_ratio <= 0.8:
            score -= 0.05

        return max(-1.0, min(1.0, score))

    @staticmethod
    def _build_reasoning(
        candidate: dict[str, Any],
        current_price: float,
        ma5: float,
        ma20: float,
        ma60: float,
        macd: float,
        rsi12: float,
        volume_ratio: float,
        tech_score: float,
        context_score: float,
    ) -> str:
        sources = ",".join(candidate.get("sources") or [candidate.get("source", "manual")])
        return (
            f"{candidate['stock_code']} 来源策略为 {sources}；价格 {current_price:.2f}，MA5/MA20/MA60 为 "
            f"{ma5:.2f}/{ma20:.2f}/{ma60:.2f}，MACD {macd:.3f}，RSI12 {rsi12:.2f}，"
            f"量比 {volume_ratio:.2f}。技术评分 {tech_score:.2f}，上下文评分 {context_score:.2f}。"
        )
