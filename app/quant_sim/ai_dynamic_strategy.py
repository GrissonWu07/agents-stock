"""AI-driven dynamic strategy control for quant live simulation and replay."""

from __future__ import annotations

import copy
from datetime import datetime
from pathlib import Path
from typing import Any

from app.news_flow_db import NewsFlowDatabase
from app.runtime_paths import default_db_path
from app.sector_strategy_db import SectorStrategyDatabase
from app.smart_monitor_db import DEFAULT_DB_FILE as SMART_MONITOR_DB_FILE, SmartMonitorDB


SUPPORTED_AI_DYNAMIC_STRATEGIES = {"off", "template", "weights", "hybrid"}
DEFAULT_AI_DYNAMIC_STRATEGY = "off"
DEFAULT_AI_DYNAMIC_STRENGTH = 0.6
DEFAULT_AI_DYNAMIC_LOOKBACK = 20

_VARIANT_KEYWORDS = {
    "aggressive": ("aggressive", "积极", "进攻"),
    "stable": ("stable", "稳", "平衡", "均衡"),
    "conservative": ("conservative", "保守", "防守", "defensive"),
}


def _txt(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def normalize_dynamic_strategy(value: Any) -> str:
    normalized = _txt(value, DEFAULT_AI_DYNAMIC_STRATEGY).lower()
    return normalized if normalized in SUPPORTED_AI_DYNAMIC_STRATEGIES else DEFAULT_AI_DYNAMIC_STRATEGY


def normalize_dynamic_strength(value: Any) -> float:
    return round(_clamp(_safe_float(value, DEFAULT_AI_DYNAMIC_STRENGTH), 0.0, 1.0), 4)


def normalize_dynamic_lookback(value: Any) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = DEFAULT_AI_DYNAMIC_LOOKBACK
    return max(5, min(parsed, 500))


def _action_score(action: str) -> float:
    normalized = _txt(action).upper()
    if normalized == "BUY":
        return 1.0
    if normalized == "SELL":
        return -1.0
    return 0.0


def _extract_sector(candidate: dict[str, Any] | None) -> str:
    if not isinstance(candidate, dict):
        return ""
    metadata = candidate.get("metadata")
    if isinstance(metadata, dict):
        for key in ("sector", "industry", "board", "所属行业", "板块"):
            sector = _txt(metadata.get(key))
            if sector:
                return sector
    for key in ("sector", "industry", "board", "所属行业", "板块"):
        sector = _txt(candidate.get(key))
        if sector:
            return sector
    return ""


def _detect_variant(profile: dict[str, Any]) -> str | None:
    profile_id = _txt(profile.get("id")).lower()
    profile_name = _txt(profile.get("name")).lower()
    haystack = f"{profile_id} {profile_name}"
    for variant, keywords in _VARIANT_KEYWORDS.items():
        if any(keyword.lower() in haystack for keyword in keywords):
            return variant
    return None


def _resolve_variant_profiles(db: Any) -> tuple[dict[str, str], str]:
    profiles = db.list_strategy_profiles(include_disabled=False)
    default_profile_id = _txt(db.get_default_strategy_profile_id())
    variant_map: dict[str, str] = {}
    for profile in profiles:
        if not isinstance(profile, dict):
            continue
        variant = _detect_variant(profile)
        if not variant:
            continue
        profile_id = _txt(profile.get("id"))
        if not profile_id:
            continue
        if variant not in variant_map:
            variant_map[variant] = profile_id
    for variant in ("aggressive", "stable", "conservative"):
        if variant not in variant_map:
            variant_map[variant] = default_profile_id
    return variant_map, default_profile_id


def _blend_scores(scores: dict[str, float | None]) -> tuple[float, list[str]]:
    weights = {
        "market": 0.35,
        "sector": 0.2,
        "news": 0.2,
        "ai": 0.25,
    }
    numerator = 0.0
    denominator = 0.0
    active: list[str] = []
    for name, weight in weights.items():
        score = scores.get(name)
        if score is None:
            continue
        numerator += float(score) * weight
        denominator += weight
        active.append(name)
    if denominator <= 0:
        return 0.0, []
    return round(_clamp(numerator / denominator, -1.0, 1.0), 4), active


def _select_variant(score: float) -> str:
    if score >= 0.3:
        return "aggressive"
    if score <= -0.3:
        return "conservative"
    return "stable"


def _score_recent_quant_signals(db: Any, lookback: int) -> float | None:
    try:
        signals = db.get_signals(limit=max(10, lookback))
    except Exception:
        return None
    if not signals:
        return None

    weighted_sum = 0.0
    total_weight = 0.0
    for item in signals:
        if not isinstance(item, dict):
            continue
        score = _action_score(_txt(item.get("action")))
        confidence = _clamp(_safe_float(item.get("confidence"), 50.0) / 100.0, 0.0, 1.0)
        weight = 0.3 + confidence * 0.7
        weighted_sum += score * weight
        total_weight += weight
    if total_weight <= 0:
        return None
    return round(_clamp(weighted_sum / total_weight, -1.0, 1.0), 4)


def _score_sector_sentiment() -> tuple[dict[str, float], float | None]:
    path = default_db_path("sector_strategy.db")
    if not Path(path).exists():
        return {}, None
    try:
        db = SectorStrategyDatabase(path)
        payload = db.get_latest_news_data(within_hours=72)
    except Exception:
        return {}, None
    rows = payload.get("data_content") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not rows:
        return {}, None

    totals: dict[str, float] = {}
    counts: dict[str, int] = {}
    for item in rows:
        if not isinstance(item, dict):
            continue
        sentiment_raw = _safe_float(item.get("sentiment_score"), 0.0)
        sentiment = _clamp(sentiment_raw / 100.0, -1.0, 1.0)
        importance = _clamp(_safe_float(item.get("importance_score"), 0.0) / 100.0, 0.0, 1.0)
        weight = 0.4 + importance * 0.6
        related = item.get("related_sectors") if isinstance(item.get("related_sectors"), list) else []
        for raw_sector in related:
            sector = _txt(raw_sector)
            if not sector:
                continue
            totals[sector] = totals.get(sector, 0.0) + sentiment * weight
            counts[sector] = counts.get(sector, 0) + 1

    sector_scores = {
        sector: round(_clamp(total / max(counts.get(sector, 1), 1), -1.0, 1.0), 4)
        for sector, total in totals.items()
        if counts.get(sector, 0) > 0
    }
    if not sector_scores:
        return {}, None
    average = round(sum(sector_scores.values()) / len(sector_scores), 4)
    return sector_scores, _clamp(average, -1.0, 1.0)


def _score_news_sentiment() -> float | None:
    path = default_db_path("news_flow.db")
    if not Path(path).exists():
        return None
    try:
        db = NewsFlowDatabase(path)
        sentiment = db.get_latest_sentiment()
    except Exception:
        return None
    if not isinstance(sentiment, dict):
        return None
    sentiment_index = _safe_float(sentiment.get("sentiment_index"), 50.0)
    score = (sentiment_index - 50.0) / 50.0
    return round(_clamp(score, -1.0, 1.0), 4)


def _score_ai_monitor(lookback: int) -> float | None:
    path = SMART_MONITOR_DB_FILE
    if not Path(path).exists():
        return None
    try:
        db = SmartMonitorDB(path)
        rows = db.get_ai_decisions(limit=max(10, lookback))
    except Exception:
        return None
    if not isinstance(rows, list) or not rows:
        return None
    weighted_sum = 0.0
    total_weight = 0.0
    for index, item in enumerate(rows):
        if not isinstance(item, dict):
            continue
        action = _txt(item.get("action")).upper()
        action_score = _action_score(action)
        confidence = _clamp(_safe_float(item.get("confidence"), 50.0) / 100.0, 0.0, 1.0)
        recency_weight = max(0.15, 1.0 - index * 0.04)
        weight = recency_weight * (0.3 + confidence * 0.7)
        weighted_sum += action_score * weight
        total_weight += weight
    if total_weight <= 0:
        return None
    return round(_clamp(weighted_sum / total_weight, -1.0, 1.0), 4)


def build_ai_dynamic_context(db: Any, scheduler_config: dict[str, Any] | None) -> dict[str, Any]:
    scheduler_payload = scheduler_config if isinstance(scheduler_config, dict) else {}
    strategy = normalize_dynamic_strategy(scheduler_payload.get("ai_dynamic_strategy"))
    strength = normalize_dynamic_strength(scheduler_payload.get("ai_dynamic_strength"))
    lookback = normalize_dynamic_lookback(scheduler_payload.get("ai_dynamic_lookback"))
    enabled = strategy != "off"
    variant_profiles, default_profile_id = _resolve_variant_profiles(db)

    if not enabled:
        return {
            "enabled": False,
            "strategy": "off",
            "strength": strength,
            "lookback": lookback,
            "composite_score": 0.0,
            "selected_variant": "stable",
            "selected_profile_id": default_profile_id,
            "variant_profiles": variant_profiles,
            "component_scores": {},
            "sector_scores": {},
            "active_components": [],
            "updated_at": datetime.now().replace(microsecond=0).isoformat(sep=" "),
        }

    market_score = _score_recent_quant_signals(db, lookback)
    sector_scores, sector_global_score = _score_sector_sentiment()
    news_score = _score_news_sentiment()
    ai_score = _score_ai_monitor(lookback)
    component_scores: dict[str, float | None] = {
        "market": market_score,
        "sector": sector_global_score,
        "news": news_score,
        "ai": ai_score,
    }
    composite_score, active_components = _blend_scores(component_scores)
    selected_variant = _select_variant(composite_score)
    selected_profile_id = _txt(variant_profiles.get(selected_variant), default_profile_id)

    return {
        "enabled": True,
        "strategy": strategy,
        "strength": strength,
        "lookback": lookback,
        "composite_score": composite_score,
        "selected_variant": selected_variant,
        "selected_profile_id": selected_profile_id,
        "variant_profiles": variant_profiles,
        "component_scores": {key: value for key, value in component_scores.items() if value is not None},
        "sector_scores": sector_scores,
        "active_components": active_components,
        "updated_at": datetime.now().replace(microsecond=0).isoformat(sep=" "),
    }


def _scaled_weight(current: Any, delta: float, floor: float = 0.05, ceil: float = 4.0) -> float:
    value = _safe_float(current, 1.0)
    if value <= 0:
        value = 1.0
    return round(_clamp(value * (1.0 + delta), floor, ceil), 6)


def _apply_dimension_overrides(weights: dict[str, Any], dynamic_score: float, scale: float) -> dict[str, Any]:
    next_weights = dict(weights)
    delta = dynamic_score * scale
    multipliers = {
        "trend_direction": 0.35,
        "ma_alignment": 0.25,
        "ma_slope": 0.25,
        "price_vs_ma20": 0.2,
        "macd_level": 0.3,
        "macd_hist_slope": 0.25,
        "rsi_zone": 0.1,
        "kdj_cross": 0.05,
        "volume_ratio": 0.2,
        "obv_trend": 0.2,
        "atr_risk": -0.45,
        "boll_position": -0.35,
        "trend_regime": 0.22,
        "price_structure": 0.18,
        "momentum": 0.16,
        "risk_balance": -0.20,
        "account_posture": -0.12,
        "liquidity": 0.1,
        "session": 0.04,
        "source_prior": 0.08,
        "execution_feedback": 0.06,
    }
    for key, factor in multipliers.items():
        if key not in next_weights:
            continue
        next_weights[key] = _scaled_weight(next_weights.get(key), delta * factor)
    return next_weights


def _apply_group_overrides(groups: dict[str, Any], dynamic_score: float, scale: float) -> dict[str, Any]:
    next_groups = dict(groups)
    delta = dynamic_score * scale
    factors = {
        "trend": 0.2,
        "momentum": 0.15,
        "volume_confirmation": 0.1,
        "volatility_risk": -0.2,
        "market_structure": 0.16,
        "risk_account": -0.2,
        "tradability_timing": 0.08,
        "source_execution": 0.06,
    }
    for key, factor in factors.items():
        if key not in next_groups:
            continue
        next_groups[key] = _scaled_weight(next_groups.get(key), delta * factor)
    return next_groups


def _apply_dual_track_overrides(dual_track: dict[str, Any], dynamic_score: float, scale: float) -> dict[str, Any]:
    next_dual_track = dict(dual_track)
    delta = dynamic_score * scale
    if "fusion_buy_threshold" in next_dual_track:
        base = _safe_float(next_dual_track.get("fusion_buy_threshold"), 0.76)
        next_dual_track["fusion_buy_threshold"] = round(_clamp(base - 0.12 * delta, 0.05, 0.98), 6)
    if "fusion_sell_threshold" in next_dual_track:
        base = _safe_float(next_dual_track.get("fusion_sell_threshold"), -0.17)
        next_dual_track["fusion_sell_threshold"] = round(_clamp(base - 0.08 * delta, -0.98, -0.02), 6)
    if "sell_precedence_gate" in next_dual_track:
        base = _safe_float(next_dual_track.get("sell_precedence_gate"), -0.5)
        next_dual_track["sell_precedence_gate"] = round(_clamp(base - 0.06 * delta, -1.0, -0.05), 6)
    track_weights = next_dual_track.get("track_weights")
    if isinstance(track_weights, dict):
        weights = dict(track_weights)
        if "tech" in weights:
            weights["tech"] = _scaled_weight(weights.get("tech"), 0.15 * delta)
        if "context" in weights:
            weights["context"] = _scaled_weight(weights.get("context"), -0.12 * delta)
        next_dual_track["track_weights"] = weights
    return next_dual_track


def _apply_profile_dynamic_overrides(
    config: dict[str, Any],
    *,
    dynamic_score: float,
    strength: float,
) -> dict[str, Any]:
    next_config = copy.deepcopy(config)
    profiles = next_config.get("profiles")
    if not isinstance(profiles, dict):
        return next_config
    for profile_key, profile_weight in (("candidate", 1.0), ("position", 0.85)):
        profile_payload = profiles.get(profile_key)
        if not isinstance(profile_payload, dict):
            continue
        scale = strength * profile_weight
        technical = profile_payload.get("technical")
        if isinstance(technical, dict):
            if isinstance(technical.get("dimension_weights"), dict):
                technical["dimension_weights"] = _apply_dimension_overrides(
                    technical["dimension_weights"],
                    dynamic_score,
                    scale,
                )
            if isinstance(technical.get("group_weights"), dict):
                technical["group_weights"] = _apply_group_overrides(
                    technical["group_weights"],
                    dynamic_score,
                    scale,
                )
        context = profile_payload.get("context")
        if isinstance(context, dict):
            if isinstance(context.get("dimension_weights"), dict):
                context["dimension_weights"] = _apply_dimension_overrides(
                    context["dimension_weights"],
                    dynamic_score,
                    scale,
                )
            if isinstance(context.get("group_weights"), dict):
                context["group_weights"] = _apply_group_overrides(
                    context["group_weights"],
                    dynamic_score,
                    scale,
                )
        dual_track = profile_payload.get("dual_track")
        if isinstance(dual_track, dict):
            profile_payload["dual_track"] = _apply_dual_track_overrides(
                dual_track,
                dynamic_score,
                scale,
            )
    return next_config


def resolve_ai_dynamic_profile_binding(
    db: Any,
    *,
    base_binding: dict[str, Any],
    candidate: dict[str, Any] | None,
    dynamic_context: dict[str, Any] | None,
) -> dict[str, Any]:
    if not isinstance(base_binding, dict):
        return base_binding
    context = dynamic_context if isinstance(dynamic_context, dict) else {}
    if not bool(context.get("enabled")):
        return base_binding

    strategy = normalize_dynamic_strategy(context.get("strategy"))
    if strategy == "off":
        return base_binding

    sector_scores = context.get("sector_scores") if isinstance(context.get("sector_scores"), dict) else {}
    sector_name = _extract_sector(candidate)
    sector_score = _safe_float(sector_scores.get(sector_name), 0.0) if sector_name else 0.0
    global_score = _safe_float(context.get("composite_score"), 0.0)
    dynamic_score = _clamp(global_score + sector_score * 0.35, -1.0, 1.0)
    strength = normalize_dynamic_strength(context.get("strength"))
    selected_binding = base_binding

    if strategy in {"template", "hybrid"}:
        variant_profiles = context.get("variant_profiles") if isinstance(context.get("variant_profiles"), dict) else {}
        target_variant = _select_variant(dynamic_score)
        target_profile_id = _txt(variant_profiles.get(target_variant))
        if target_profile_id:
            current_profile_id = _txt(base_binding.get("profile_id"))
            if target_profile_id != current_profile_id:
                try:
                    selected_binding = db.resolve_strategy_profile_binding(target_profile_id)
                except Exception:
                    selected_binding = base_binding

    if strategy in {"weights", "hybrid"}:
        selected_binding = copy.deepcopy(selected_binding)
        config_payload = selected_binding.get("config")
        if isinstance(config_payload, dict):
            selected_binding["config"] = _apply_profile_dynamic_overrides(
                config_payload,
                dynamic_score=dynamic_score,
                strength=strength,
            )

    result = copy.deepcopy(selected_binding)
    result["dynamic_strategy"] = {
        "enabled": True,
        "strategy": strategy,
        "dynamic_score": round(dynamic_score, 4),
        "global_score": round(global_score, 4),
        "sector": sector_name,
        "sector_score": round(sector_score, 4),
        "strength": strength,
        "component_scores": context.get("component_scores") if isinstance(context.get("component_scores"), dict) else {},
        "selected_variant": _select_variant(dynamic_score),
        "updated_at": _txt(context.get("updated_at"), datetime.now().replace(microsecond=0).isoformat(sep=" ")),
    }
    return result


__all__ = [
    "DEFAULT_AI_DYNAMIC_LOOKBACK",
    "DEFAULT_AI_DYNAMIC_STRENGTH",
    "DEFAULT_AI_DYNAMIC_STRATEGY",
    "SUPPORTED_AI_DYNAMIC_STRATEGIES",
    "build_ai_dynamic_context",
    "normalize_dynamic_lookback",
    "normalize_dynamic_strength",
    "normalize_dynamic_strategy",
    "resolve_ai_dynamic_profile_binding",
]

