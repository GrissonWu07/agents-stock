"""AI-driven dynamic strategy control for quant simulation."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Iterable

from app.news_flow_db import news_flow_db
from app.quant_sim.db import DEFAULT_DB_FILE, QuantSimDB
from app.sector_strategy_db import DEFAULT_DB_PATH as DEFAULT_SECTOR_DB_PATH
from app.sector_strategy_db import SectorStrategyDatabase
from app.smart_monitor_db import DEFAULT_DB_FILE as DEFAULT_SMART_MONITOR_DB_FILE
from app.smart_monitor_db import SmartMonitorDB

DEFAULT_AI_DYNAMIC_STRATEGY = "off"
SUPPORTED_AI_DYNAMIC_STRATEGIES = {"off", "template", "weights", "hybrid"}
DEFAULT_AI_DYNAMIC_STRENGTH = 0.5
DEFAULT_AI_DYNAMIC_LOOKBACK = 48
BUILTIN_PROFILE_BY_TEMPLATE = {
    "aggressive": "aggressive_v23",
    "stable": "stable_v23",
    "conservative": "conservative_v23",
}


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    if parsed != parsed:  # NaN
        return default
    return parsed


def _parse_datetime(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text[:19], fmt)
        except ValueError:
            continue
    return None


class DynamicStrategyController:
    """Build runtime strategy-profile overrides from market/sector/news/AI signals."""

    def __init__(
        self,
        db_file: str | Path = DEFAULT_DB_FILE,
        *,
        smart_monitor_db_file: str | Path = DEFAULT_SMART_MONITOR_DB_FILE,
        sector_db_file: str | Path = DEFAULT_SECTOR_DB_PATH,
    ):
        self.db = QuantSimDB(db_file=db_file)
        self.smart_monitor_db_file = str(smart_monitor_db_file)
        self.sector_db_file = str(sector_db_file)
        self.logger = logging.getLogger(__name__)
        self._smart_monitor_db: SmartMonitorDB | None = None
        self._sector_db: SectorStrategyDatabase | None = None

    @staticmethod
    def normalize_strategy(value: Any) -> str:
        normalized = str(value or DEFAULT_AI_DYNAMIC_STRATEGY).strip().lower()
        return normalized if normalized in SUPPORTED_AI_DYNAMIC_STRATEGIES else DEFAULT_AI_DYNAMIC_STRATEGY

    @staticmethod
    def normalize_strength(value: Any) -> float:
        return round(_clamp(_safe_float(value, DEFAULT_AI_DYNAMIC_STRENGTH), 0.0, 1.0), 4)

    @staticmethod
    def normalize_lookback(value: Any) -> int:
        parsed = int(round(_safe_float(value, DEFAULT_AI_DYNAMIC_LOOKBACK)))
        return int(_clamp(parsed, 6, 336))

    def resolve_binding(
        self,
        *,
        base_binding: dict[str, Any],
        stock_code: str | None,
        stock_name: str | None,
        ai_dynamic_strategy: Any,
        ai_dynamic_strength: Any,
        ai_dynamic_lookback: Any,
    ) -> dict[str, Any]:
        mode = self.normalize_strategy(ai_dynamic_strategy)
        strength = self.normalize_strength(ai_dynamic_strength)
        lookback = self.normalize_lookback(ai_dynamic_lookback)
        binding = self._clone_binding(base_binding)
        if mode == "off":
            binding["dynamic_strategy"] = {
                "mode": mode,
                "enabled": False,
                "strength": strength,
                "lookback_hours": lookback,
            }
            return binding

        signal = self._build_dynamic_signal(
            stock_code=stock_code,
            stock_name=stock_name,
            lookback_hours=lookback,
        )
        template_variant = self._select_template(signal["score"])
        template_profile_id = BUILTIN_PROFILE_BY_TEMPLATE[template_variant]

        if mode in {"template", "hybrid"} and template_profile_id:
            try:
                binding = self._clone_binding(self.db.resolve_strategy_profile_binding(template_profile_id))
            except Exception as exc:
                self.logger.warning("dynamic strategy template fallback failed: %s", exc)

        if mode in {"weights", "hybrid"}:
            config_payload = binding.get("config")
            if isinstance(config_payload, dict):
                adjusted = self._apply_dynamic_weight_overlay(
                    config_payload,
                    signal_score=float(signal["score"]),
                    strength=strength,
                )
                binding["config"] = adjusted

        binding["dynamic_strategy"] = {
            "mode": mode,
            "enabled": True,
            "strength": strength,
            "lookback_hours": lookback,
            "score": round(float(signal["score"]), 4),
            "confidence": round(float(signal["confidence"]), 4),
            "template_variant": template_variant,
            "template_profile_id": template_profile_id,
            "components": signal.get("components", []),
        }
        return binding

    def _smart_db(self) -> SmartMonitorDB:
        if self._smart_monitor_db is None:
            self._smart_monitor_db = SmartMonitorDB(self.smart_monitor_db_file)
        return self._smart_monitor_db

    def _sector_db_instance(self) -> SectorStrategyDatabase:
        if self._sector_db is None:
            self._sector_db = SectorStrategyDatabase(self.sector_db_file)
        return self._sector_db

    def _build_dynamic_signal(
        self,
        *,
        stock_code: str | None,
        stock_name: str | None,
        lookback_hours: int,
    ) -> dict[str, Any]:
        component_rows: list[dict[str, Any]] = []
        market_component = self._market_component(lookback_hours=lookback_hours)
        if market_component:
            component_rows.append(market_component)
        sector_component = self._sector_component(stock_name=stock_name, lookback_hours=lookback_hours)
        if sector_component:
            component_rows.append(sector_component)
        news_component = self._news_component()
        if news_component:
            component_rows.append(news_component)
        ai_component = self._ai_component(stock_code=stock_code, lookback_hours=lookback_hours)
        if ai_component:
            component_rows.append(ai_component)
        if not component_rows:
            return {"score": 0.0, "confidence": 0.0, "components": []}

        weighted_score = 0.0
        weighted_confidence = 0.0
        total_weight = 0.0
        for item in component_rows:
            weight = _clamp(_safe_float(item.get("weight"), 0.0), 0.0, 1.0)
            score = _clamp(_safe_float(item.get("score"), 0.0), -1.0, 1.0)
            confidence = _clamp(_safe_float(item.get("confidence"), 0.0), 0.0, 1.0)
            if weight <= 0:
                continue
            total_weight += weight
            weighted_score += score * weight
            weighted_confidence += confidence * weight
        if total_weight <= 0:
            return {"score": 0.0, "confidence": 0.0, "components": []}
        return {
            "score": _clamp(weighted_score / total_weight, -1.0, 1.0),
            "confidence": _clamp(weighted_confidence / total_weight, 0.0, 1.0),
            "components": component_rows,
        }

    def _market_component(self, *, lookback_hours: int) -> dict[str, Any] | None:
        try:
            market = self._sector_db_instance().get_latest_raw_data("market_overview", within_hours=lookback_hours)
        except Exception as exc:
            self.logger.debug("dynamic strategy market component failed: %s", exc)
            market = None
        overview = market.get("data_content") if isinstance(market, dict) else {}
        if isinstance(overview, dict) and overview:
            scores: list[float] = []
            for payload in overview.values():
                if not isinstance(payload, dict):
                    continue
                change_pct = _safe_float(payload.get("change_pct"), 0.0)
                scores.append(_clamp(change_pct / 2.5, -1.0, 1.0))
            if scores:
                score = sum(scores) / len(scores)
                return {
                    "key": "market",
                    "label": "market",
                    "weight": 0.35,
                    "score": score,
                    "confidence": 0.75,
                    "reason": f"market_overview({len(scores)})",
                }
        latest_snapshot = news_flow_db.get_latest_snapshot()
        if isinstance(latest_snapshot, dict):
            total_score = _safe_float(latest_snapshot.get("total_score"), 500.0)
            score = _clamp((total_score - 500.0) / 500.0, -1.0, 1.0)
            return {
                "key": "market",
                "label": "market",
                "weight": 0.35,
                "score": score,
                "confidence": 0.45,
                "reason": "flow_total_score_fallback",
            }
        return None

    def _sector_component(self, *, stock_name: str | None, lookback_hours: int) -> dict[str, Any] | None:
        try:
            news_payload = self._sector_db_instance().get_latest_news_data(within_hours=lookback_hours)
        except Exception as exc:
            self.logger.debug("dynamic strategy sector component failed: %s", exc)
            news_payload = None
        rows = news_payload.get("data_content") if isinstance(news_payload, dict) else []
        if not isinstance(rows, Iterable):
            return None
        sector_rows = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            sentiment = _safe_float(row.get("sentiment_score"), 0.0)
            importance = _clamp(_safe_float(row.get("importance_score"), 1.0), 0.1, 100.0)
            sector_rows.append((_clamp(sentiment / 100.0, -1.0, 1.0), importance))
        if not sector_rows:
            return None
        weighted_sum = sum(score * weight for score, weight in sector_rows)
        weight_sum = sum(weight for _, weight in sector_rows)
        if weight_sum <= 0:
            return None
        score = _clamp(weighted_sum / weight_sum, -1.0, 1.0)
        confidence = _clamp(min(1.0, len(sector_rows) / 30.0), 0.3, 0.9)
        return {
            "key": "sector",
            "label": "sector",
            "weight": 0.2,
            "score": score,
            "confidence": confidence,
            "reason": f"sector_news({len(sector_rows)})",
        }

    def _news_component(self) -> dict[str, Any] | None:
        sentiment = news_flow_db.get_latest_sentiment()
        ai_analysis = news_flow_db.get_latest_ai_analysis()
        has_signal = False
        score_parts: list[float] = []
        confidence_parts: list[float] = []
        if isinstance(sentiment, dict):
            has_signal = True
            index_value = _safe_float(sentiment.get("sentiment_index"), 50.0)
            score_parts.append(_clamp((index_value - 50.0) / 50.0, -1.0, 1.0))
            confidence_parts.append(0.7)
        if isinstance(ai_analysis, dict):
            has_signal = True
            confidence = _clamp(_safe_float(ai_analysis.get("confidence"), 50.0) / 100.0, 0.1, 1.0)
            risk_level = str(ai_analysis.get("risk_level") or "").lower()
            risk_score = 0.0
            if "高" in risk_level or "high" in risk_level:
                risk_score = -0.6
            elif "低" in risk_level or "low" in risk_level:
                risk_score = 0.4
            score_parts.append(risk_score)
            confidence_parts.append(confidence)
        if not has_signal:
            return None
        score = sum(score_parts) / len(score_parts) if score_parts else 0.0
        confidence = sum(confidence_parts) / len(confidence_parts) if confidence_parts else 0.0
        return {
            "key": "news",
            "label": "news",
            "weight": 0.2,
            "score": _clamp(score, -1.0, 1.0),
            "confidence": _clamp(confidence, 0.0, 1.0),
            "reason": "news_flow_sentiment+ai",
        }

    def _ai_component(self, *, stock_code: str | None, lookback_hours: int) -> dict[str, Any] | None:
        try:
            rows = self._smart_db().get_ai_decisions(stock_code=stock_code, limit=min(500, lookback_hours * 8))
        except Exception as exc:
            self.logger.debug("dynamic strategy ai component failed: %s", exc)
            return None
        if not rows:
            return None
        cutoff = datetime.now() - timedelta(hours=lookback_hours)
        score_sum = 0.0
        weight_sum = 0.0
        used = 0
        for row in rows:
            if not isinstance(row, dict):
                continue
            decision_time = _parse_datetime(row.get("decision_time") or row.get("created_at"))
            if decision_time is not None and decision_time < cutoff:
                continue
            action = str(row.get("action") or "").strip().upper()
            base_score = 0.0
            if action in {"BUY", "BUG"}:
                base_score = 1.0
            elif action == "SELL":
                base_score = -1.0
            confidence = _clamp(_safe_float(row.get("confidence"), 50.0) / 100.0, 0.1, 1.0)
            score_sum += base_score * confidence
            weight_sum += confidence
            used += 1
        if used == 0 or weight_sum <= 0:
            return None
        score = _clamp(score_sum / weight_sum, -1.0, 1.0)
        confidence = _clamp(min(1.0, used / 20.0), 0.25, 0.95)
        return {
            "key": "ai",
            "label": "ai",
            "weight": 0.25,
            "score": score,
            "confidence": confidence,
            "reason": f"ai_decisions({used})",
        }

    @staticmethod
    def _select_template(score: float) -> str:
        if score >= 0.2:
            return "aggressive"
        if score <= -0.2:
            return "conservative"
        return "stable"

    def _apply_dynamic_weight_overlay(
        self,
        config: dict[str, Any],
        *,
        signal_score: float,
        strength: float,
    ) -> dict[str, Any]:
        payload = self._deep_copy_json(config)
        profiles = payload.get("profiles")
        if not isinstance(profiles, dict):
            return payload
        for profile_key in ("candidate", "position"):
            profile_payload = profiles.get(profile_key)
            if not isinstance(profile_payload, dict):
                continue
            self._adjust_technical(profile_payload, signal_score=signal_score, strength=strength)
            self._adjust_context(profile_payload, signal_score=signal_score, strength=strength)
            self._adjust_dual_track(profile_payload, signal_score=signal_score, strength=strength)
        return payload

    def _adjust_technical(self, profile_payload: dict[str, Any], *, signal_score: float, strength: float) -> None:
        technical = profile_payload.get("technical")
        if not isinstance(technical, dict):
            return
        group_weights = technical.get("group_weights")
        if isinstance(group_weights, dict):
            self._adjust_weight(group_weights, "trend", signal_score, strength, coefficient=0.35)
            self._adjust_weight(group_weights, "momentum", signal_score, strength, coefficient=0.30)
            self._adjust_weight(group_weights, "volume_confirmation", signal_score, strength, coefficient=0.20)
            self._adjust_weight(group_weights, "volatility_risk", signal_score, strength, coefficient=-0.40)
        dimension_weights = technical.get("dimension_weights")
        if isinstance(dimension_weights, dict):
            for key in ("trend_direction", "ma_alignment", "ma_slope", "price_vs_ma20", "macd_level", "macd_hist_slope"):
                self._adjust_weight(dimension_weights, key, signal_score, strength, coefficient=0.22)
            for key in ("rsi_zone", "kdj_cross", "volume_ratio", "obv_trend"):
                self._adjust_weight(dimension_weights, key, signal_score, strength, coefficient=0.16)
            for key in ("atr_risk", "boll_position"):
                self._adjust_weight(dimension_weights, key, signal_score, strength, coefficient=-0.28)

    def _adjust_context(self, profile_payload: dict[str, Any], *, signal_score: float, strength: float) -> None:
        context = profile_payload.get("context")
        if not isinstance(context, dict):
            return
        group_weights = context.get("group_weights")
        if isinstance(group_weights, dict):
            self._adjust_weight(group_weights, "market_structure", signal_score, strength, coefficient=0.30)
            self._adjust_weight(group_weights, "risk_account", signal_score, strength, coefficient=-0.38)
            self._adjust_weight(group_weights, "tradability_timing", signal_score, strength, coefficient=0.12)
            self._adjust_weight(group_weights, "source_execution", signal_score, strength, coefficient=0.10)
        dimension_weights = context.get("dimension_weights")
        if isinstance(dimension_weights, dict):
            for key in ("trend_regime", "price_structure", "momentum", "source_prior"):
                self._adjust_weight(dimension_weights, key, signal_score, strength, coefficient=0.18)
            for key in ("risk_balance", "account_posture"):
                self._adjust_weight(dimension_weights, key, signal_score, strength, coefficient=-0.32)
            for key in ("liquidity", "session", "execution_feedback"):
                self._adjust_weight(dimension_weights, key, signal_score, strength, coefficient=0.08)

    def _adjust_dual_track(self, profile_payload: dict[str, Any], *, signal_score: float, strength: float) -> None:
        dual_track = profile_payload.get("dual_track")
        if not isinstance(dual_track, dict):
            return
        adjust = signal_score * strength
        track_weights = dual_track.get("track_weights")
        if isinstance(track_weights, dict):
            self._adjust_weight(track_weights, "tech", signal_score, strength, coefficient=0.22)
            self._adjust_weight(track_weights, "context", signal_score, strength, coefficient=-0.22)
        buy_threshold = _safe_float(dual_track.get("fusion_buy_threshold"), 0.76) - (0.10 * adjust)
        sell_threshold = _safe_float(dual_track.get("fusion_sell_threshold"), -0.17) - (0.08 * adjust)
        dual_track["fusion_buy_threshold"] = round(_clamp(buy_threshold, 0.35, 1.35), 4)
        dual_track["fusion_sell_threshold"] = round(_clamp(sell_threshold, -1.35, -0.02), 4)
        min_confidence = _safe_float(dual_track.get("min_fusion_confidence"), 0.5) + (abs(adjust) * 0.05)
        dual_track["min_fusion_confidence"] = round(_clamp(min_confidence, 0.3, 0.95), 4)

        threshold_mode = str(dual_track.get("threshold_mode") or "static")
        sell_vol_k = _safe_float(dual_track.get("sell_vol_k"), 0.0)
        gate_raw = _safe_float(dual_track.get("sell_precedence_gate"), -0.5) - (0.08 * adjust)
        max_allowed_gate = _safe_float(dual_track.get("fusion_sell_threshold"), -0.17)
        if threshold_mode == "volatility_adjusted":
            max_allowed_gate -= sell_vol_k
        dual_track["sell_precedence_gate"] = round(min(gate_raw, max_allowed_gate), 4)

    @staticmethod
    def _adjust_weight(
        mapping: dict[str, Any],
        key: str,
        signal_score: float,
        strength: float,
        *,
        coefficient: float,
    ) -> None:
        if key not in mapping:
            return
        baseline = _safe_float(mapping.get(key), 0.0)
        if baseline <= 0:
            return
        multiplier = 1.0 + (signal_score * strength * coefficient)
        adjusted = baseline * _clamp(multiplier, 0.6, 1.6)
        mapping[key] = round(_clamp(adjusted, 0.05, 5.0), 4)

    @staticmethod
    def _clone_binding(binding: dict[str, Any]) -> dict[str, Any]:
        payload = dict(binding)
        if isinstance(payload.get("config"), dict):
            payload["config"] = DynamicStrategyController._deep_copy_json(payload["config"])
        return payload

    @staticmethod
    def _deep_copy_json(payload: dict[str, Any]) -> dict[str, Any]:
        return json.loads(json.dumps(payload, ensure_ascii=False))
