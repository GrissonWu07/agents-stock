from __future__ import annotations

from app.gateway.deps import *
from app.gateway.context import UIApiContext

def _safe_json_load(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _profile_text(value: Any, default: str = "--") -> str:
    if isinstance(value, dict):
        return _txt(value.get("key") or value.get("label") or value.get("name") or value.get("value"), default)
    return _txt(value, default)


def _profile_summary_text(value: Any, default: str = "--") -> str:
    if not isinstance(value, dict):
        return _txt(value, default)
    label = _txt(
        value.get("label")
        or value.get("标签")
        or value.get("tag")
        or value.get("name")
        or value.get("key")
        or value.get("value")
    )
    score = _txt(value.get("score") or value.get("信号分"))
    reason = _txt(value.get("reason") or value.get("说明") or value.get("detail"))
    segments: list[str] = []
    if label:
        segments.append(label)
    if score:
        segments.append(f"score={score}")
    if reason:
        segments.append(reason)
    if not segments:
        return default
    return " | ".join(segments)


def _normalize_profile_label(profile_id: str, profile_name: str) -> str:
    name = _txt(profile_name)
    if name and name != "--":
        return name
    pid = _txt(profile_id)
    if not pid or pid == "--":
        return "--"
    pid = re.sub(r"_v\d+(?:\.\d+)?$", "", pid, flags=re.IGNORECASE)
    return pid


def _to_vote_row(item: Any, default_signal: str = "") -> dict[str, str]:
    if not isinstance(item, dict):
        return {"factor": _txt(item), "signal": default_signal, "score": "", "reason": ""}
    return {
        "factor": _txt(item.get("factor") or item.get("component") or item.get("name") or item.get("title")),
        "signal": _txt(item.get("signal") or item.get("vote") or item.get("decision"), default_signal),
        "score": _txt(item.get("score") or item.get("confidence")),
        "reason": _txt(item.get("reason") or item.get("note") or item.get("detail")),
    }


def _extract_technical_indicators(
    *,
    tech_votes: list[dict[str, Any]],
    context_votes: list[dict[str, Any]],
    reasoning: str,
    analysis_text: str = "",
    strategy_profile: dict[str, Any] | None = None,
    technical_breakdown: dict[str, Any] | None = None,
    context_breakdown: dict[str, Any] | None = None,
) -> list[dict[str, str]]:
    snapshot_indicator_map: dict[str, dict[str, str]] = {}

    def _add_snapshot_indicator(name: str, value: Any, source: str, note: str = "") -> None:
        normalized = _txt(name)
        text = _txt(value)
        if not normalized or not text or normalized in snapshot_indicator_map:
            return
        snapshot_indicator_map[normalized] = {
            "name": normalized,
            "value": text,
            "source": source,
            "note": _txt(note),
        }

    def _scan_snapshot_mapping(mapping: Any, source: str, note: str = "") -> None:
        if not isinstance(mapping, dict):
            return
        key_map = [
            ("当前价", ("current_price", "latest_price", "close", "last_price")),
            ("涨跌幅", ("change_pct", "pct_chg")),
            ("开盘价", ("open", "open_price")),
            ("最高价", ("high", "high_price")),
            ("最低价", ("low", "low_price")),
            ("成交量(手)", ("volume", "vol")),
            ("成交额(万)", ("amount", "turnover")),
            ("换手率", ("turnover_rate", "turnover_ratio")),
            ("量比", ("volume_ratio",)),
            ("趋势", ("trend",)),
            ("MA5", ("ma5",)),
            ("MA20", ("ma20",)),
            ("MA60", ("ma60",)),
            ("MACD", ("macd", "hist", "macd_hist")),
            ("DIF", ("dif", "macd_dif")),
            ("DEA", ("dea", "macd_dea")),
            ("RSI6", ("rsi6",)),
            ("RSI12", ("rsi12", "rsi14")),
            ("RSI24", ("rsi24",)),
            ("KDJ-K", ("k", "kdj_k")),
            ("KDJ-D", ("d", "kdj_d")),
            ("KDJ-J", ("j", "kdj_j")),
            ("布林上轨", ("boll_upper",)),
            ("布林中轨", ("boll_mid",)),
            ("布林下轨", ("boll_lower",)),
            ("布林位置", ("boll_position",)),
        ]
        for label, keys in key_map:
            for key in keys:
                value = mapping.get(key)
                if value in (None, ""):
                    continue
                _add_snapshot_indicator(label, value, source, note or key)
                break

    def _scan_snapshot_text(text: str, source: str, note: str = "") -> None:
        content = _txt(text)
        if not content:
            return
        number = r"(-?\d+(?:\.\d+)?)"
        matched = re.search(
            rf"close\s*/\s*ma20\s*/\s*ma60\s*=\s*{number}\s*/\s*{number}\s*/\s*{number}",
            content,
            flags=re.IGNORECASE,
        )
        if matched:
            _add_snapshot_indicator("当前价", matched.group(1), source, note or content)
            _add_snapshot_indicator("MA20", matched.group(2), source, note or content)
            _add_snapshot_indicator("MA60", matched.group(3), source, note or content)

        matched = re.search(
            rf"dif\s*/\s*dea\s*/\s*(?:hist|macd)\s*=\s*{number}\s*/\s*{number}\s*/\s*{number}",
            content,
            flags=re.IGNORECASE,
        )
        if matched:
            _add_snapshot_indicator("DIF", matched.group(1), source, note or content)
            _add_snapshot_indicator("DEA", matched.group(2), source, note or content)
            _add_snapshot_indicator("MACD", matched.group(3), source, note or content)

        matched = re.search(
            rf"k\s*/\s*d\s*/\s*j\s*=\s*{number}\s*/\s*{number}\s*/\s*{number}",
            content,
            flags=re.IGNORECASE,
        )
        if matched:
            _add_snapshot_indicator("KDJ-K", matched.group(1), source, note or content)
            _add_snapshot_indicator("KDJ-D", matched.group(2), source, note or content)
            _add_snapshot_indicator("KDJ-J", matched.group(3), source, note or content)

        for label, pattern in (
            ("当前价", rf"(?:现价|当前价|最新价)\s*[:：]?\s*{number}"),
            ("MA5", rf"MA5\s*[:：=]?\s*{number}"),
            ("MA20", rf"MA20\s*[:：=]?\s*{number}"),
            ("MA60", rf"MA60\s*[:：=]?\s*{number}"),
            ("MACD", rf"MACD\s*[:：=]?\s*{number}"),
            ("量比", rf"(?:volume_ratio|量比)\s*[:：=]?\s*{number}"),
            ("布林位置", rf"boll_position\s*[:：=]?\s*{number}"),
        ):
            matched = re.search(pattern, content, flags=re.IGNORECASE)
            if matched:
                _add_snapshot_indicator(label, matched.group(1), source, note or content)

        for matched in re.finditer(rf"\b(RSI6|RSI12|RSI14|RSI24)\s*[:：=]?\s*{number}", content, flags=re.IGNORECASE):
            metric = matched.group(1).upper()
            label = "RSI12" if metric == "RSI14" else metric
            _add_snapshot_indicator(label, matched.group(2), source, note or content)

    if isinstance(technical_breakdown, dict):
        indicators: list[dict[str, str]] = []
        profile = strategy_profile if isinstance(strategy_profile, dict) else {}
        _scan_snapshot_mapping(profile.get("market_snapshot"), "strategy_profile.market_snapshot")
        explainability_snapshot = profile.get("explainability") if isinstance(profile.get("explainability"), dict) else {}
        _scan_snapshot_mapping(explainability_snapshot.get("market_snapshot"), "strategy_profile.explainability.market_snapshot")
        market_regime = profile.get("market_regime")
        if isinstance(market_regime, dict):
            _add_snapshot_indicator("趋势", market_regime.get("label"), "strategy_profile.market_regime", _txt(market_regime.get("reason")))
            _scan_snapshot_text(_txt(market_regime.get("reason")), "strategy_profile.market_regime")
        track_info = technical_breakdown.get("track") if isinstance(technical_breakdown.get("track"), dict) else {}
        indicators.append(
            {
                "name": "technical.track.score",
                "value": _txt(track_info.get("score"), "0"),
                "source": "technical_breakdown.track",
                "note": "技术轨总分（TrackScore）",
            }
        )
        indicators.append(
            {
                "name": "technical.track.confidence",
                "value": _txt(track_info.get("confidence"), "0"),
                "source": "technical_breakdown.track",
                "note": "技术轨置信度（TrackConfidence）",
            }
        )

        group_rows = technical_breakdown.get("groups")
        if isinstance(group_rows, list):
            for item in group_rows:
                if not isinstance(item, dict):
                    continue
                gid = _txt(item.get("id"), "group")
                indicators.append(
                    {
                        "name": f"technical.group.{gid}",
                        "value": _txt(item.get("score"), "0"),
                        "source": "technical_breakdown.groups",
                        "note": f"coverage={_txt(item.get('coverage'), '--')}; weight_norm={_txt(item.get('weight_norm_in_track'), '--')}; track_contribution={_txt(item.get('track_contribution'), '--')}",
                    }
                )

        dim_rows = technical_breakdown.get("dimensions")
        if isinstance(dim_rows, list):
            for item in dim_rows:
                if not isinstance(item, dict):
                    continue
                dim_id = _txt(item.get("id"), "dimension")
                reason = _txt(item.get("reason"))
                _scan_snapshot_text(reason, "technical_breakdown.dimensions", dim_id)
                indicators.append(
                    {
                        "name": dim_id,
                        "value": _txt(item.get("score"), "0"),
                        "source": "technical_breakdown.dimensions",
                        "note": f"group={_txt(item.get('group'), '--')}; weight_raw={_txt(item.get('weight_raw'), '--')}; w_norm={_txt(item.get('weight_norm_in_group'), '--')}; group_contribution={_txt(item.get('group_contribution'), '--')}; track_contribution={_txt(item.get('track_contribution'), '--')}; reason={_txt(item.get('reason'), '--')}",
                    }
                )

        if isinstance(context_breakdown, dict):
            ctx_track = context_breakdown.get("track") if isinstance(context_breakdown.get("track"), dict) else {}
            indicators.append(
                {
                    "name": "context.track.score",
                    "value": _txt(ctx_track.get("score"), "0"),
                    "source": "context_breakdown.track",
                    "note": "环境轨总分（TrackScore）",
                }
            )
            indicators.append(
                {
                    "name": "context.track.confidence",
                    "value": _txt(ctx_track.get("confidence"), "0"),
                    "source": "context_breakdown.track",
                    "note": "环境轨置信度（TrackConfidence）",
                }
            )
            context_dimensions = context_breakdown.get("dimensions")
            if isinstance(context_dimensions, list):
                for item in context_dimensions:
                    if isinstance(item, dict):
                        _scan_snapshot_text(_txt(item.get("reason")), "context_breakdown.dimensions", _txt(item.get("id"), "dimension"))

        _scan_snapshot_text(_txt(reasoning), "reasoning")
        _scan_snapshot_text(_txt(analysis_text), "analysis")
        existing_names = {_txt(item.get("name")) for item in indicators if isinstance(item, dict)}
        indicators.extend(
            item for item in snapshot_indicator_map.values() if _txt(item.get("name")) not in existing_names
        )
        return indicators

    patterns = [
        ("现价", r"现价\s*(-?\d+(?:\.\d+)?)"),
        ("现价", r"价格\s*(-?\d+(?:\.\d+)?)"),
        ("成本", r"成本\s*(-?\d+(?:\.\d+)?)"),
        ("MA5", r"MA5\s*(-?\d+(?:\.\d+)?)"),
        ("MA10", r"MA10\s*(-?\d+(?:\.\d+)?)"),
        ("MA20", r"MA20\s*(-?\d+(?:\.\d+)?)"),
        ("MA60", r"MA60\s*(-?\d+(?:\.\d+)?)"),
        ("MACD", r"MACD\s*(-?\d+(?:\.\d+)?)"),
        ("RSI12", r"RSI12\s*(-?\d+(?:\.\d+)?)"),
        ("量比", r"量比\s*(-?\d+(?:\.\d+)?)"),
        ("成交量", r"成交量\s*[:：]?\s*([-\d,.]+(?:亿|万)?(?:手|股)?)"),
        ("5日均量", r"(?:5日均量|五日均量|VOL5|Volume_MA5)\s*[:：]?\s*([-\d,.]+(?:亿|万)?(?:手|股)?)"),
        ("换手率", r"换手率\s*[:：]?\s*(-?\d+(?:\.\d+)?)%?"),
        ("成交额", r"成交额\s*[:：]?\s*([-\d,.]+(?:亿|万)?(?:元)?)"),
        ("浮盈亏", r"浮盈亏\s*(-?\d+(?:\.\d+)?)%"),
    ]
    indicator_map: dict[str, dict[str, str]] = {}

    def _add_indicator(name: str, value: str, source: str, note: str = "") -> None:
        normalized = _txt(name)
        if not normalized or normalized in indicator_map:
            return
        indicator_map[normalized] = {
            "name": normalized,
            "value": _txt(value),
            "source": source,
            "note": _txt(note),
        }

    def _scan_text(text: str, source: str, note: str = "") -> None:
        content = _txt(text)
        if not content:
            return
        for metric, pattern in patterns:
            matched = re.search(pattern, content)
            if not matched:
                continue
            value = _txt(matched.group(1))
            if metric in {"浮盈亏", "换手率"} and value and not value.endswith("%"):
                value = f"{value}%"
            _add_indicator(metric, value, source, note or content)

    for vote in tech_votes:
        if not isinstance(vote, dict):
            continue
        factor = _txt(vote.get("factor") or vote.get("name"))
        score_text = _txt(vote.get("score"))
        reason = _txt(vote.get("reason"))
        if factor and score_text:
            _add_indicator(f"{factor}打分", score_text, "tech_vote", reason)
        _scan_text(reason, "tech_vote_reason", reason)

    for vote in context_votes:
        if not isinstance(vote, dict):
            continue
        component = _txt(vote.get("component") or vote.get("factor") or vote.get("name"))
        score_text = _txt(vote.get("score"))
        reason = _txt(vote.get("reason") or vote.get("note") or vote.get("detail"))
        if component.lower() in {"liquidity", "volume", "volume_flow"} and score_text:
            _add_indicator("流动性打分", score_text, "context_vote", reason)
        _scan_text(reason, "context_vote_reason", reason)

    _scan_text(_txt(reasoning), "reasoning")
    _scan_text(_txt(analysis_text), "analysis")

    profile = strategy_profile if isinstance(strategy_profile, dict) else {}
    market_regime = profile.get("market_regime")
    if isinstance(market_regime, dict):
        _scan_text(_txt(market_regime.get("reason")), "strategy_profile")
    for key in ("risk_style", "auto_inferred_risk_style", "analysis_timeframe"):
        item = profile.get(key)
        if isinstance(item, dict):
            _scan_text(_txt(item.get("reason")), "strategy_profile")

    return list(indicator_map.values())


def _detect_provider(api_base_url: str) -> str:
    base = api_base_url.lower()
    if "openrouter.ai" in base:
        return "openrouter"
    if "openai.com" in base:
        return "openai"
    return "openai-compatible"


def _build_runtime_context(
    context: UIApiContext,
    *,
    source: str,
    strategy_profile: dict[str, Any],
    replay_run: dict[str, Any] | None = None,
) -> dict[str, Any]:
    config = context.config_manager.read_env()
    scheduler_status = context.scheduler().get_status()

    model_name = _txt(config.get("DEFAULT_MODEL_NAME"), "--")
    api_base_url = _txt(config.get("AI_API_BASE_URL"), "--")
    provider = _detect_provider(api_base_url)

    if source == "replay":
        market = _txt((replay_run or {}).get("market"), _txt(scheduler_status.get("market"), "CN"))
        timeframe = _profile_text((replay_run or {}).get("timeframe"), _profile_text(strategy_profile.get("analysis_timeframe"), _txt(scheduler_status.get("analysis_timeframe"), "30m")))
        strategy_mode = _profile_text((replay_run or {}).get("selected_strategy_mode") or (replay_run or {}).get("strategy_mode"), _profile_text(strategy_profile.get("strategy_mode"), _txt(scheduler_status.get("strategy_mode"), "auto")))
    else:
        market = _txt(scheduler_status.get("market"), "CN")
        timeframe = _profile_text(strategy_profile.get("analysis_timeframe"), _txt(scheduler_status.get("analysis_timeframe"), "30m"))
        strategy_mode = _profile_text(strategy_profile.get("strategy_mode"), _txt(scheduler_status.get("strategy_mode"), "auto"))

    return {
        "model": model_name,
        "provider": provider,
        "apiBaseUrl": api_base_url,
        "market": market,
        "timeframe": timeframe,
        "strategyMode": strategy_mode,
        "autoExecute": bool(scheduler_status.get("auto_execute")),
        "intervalMinutes": _txt(scheduler_status.get("interval_minutes"), "--"),
        "lastRunAt": _txt(scheduler_status.get("last_run_at"), "--"),
        "source": source,
    }
def _parse_metric_float(value: Any) -> float | None:
    text = _txt(value)
    if not text:
        return None
    matched = re.search(r"-?\d+(?:\.\d+)?", text)
    if not matched:
        return None
    try:
        return float(matched.group(0))
    except (TypeError, ValueError):
        return None


def _indicator_derivation(
    *,
    name: str,
    value: Any,
    source: str,
    note: str,
    metric_values: dict[str, float],
) -> str:
    metric_name = _txt(name)
    metric_upper = metric_name.upper()
    metric_value = _parse_metric_float(value)
    current_price = metric_values.get("现价")
    ma20 = metric_values.get("MA20")
    k_value = metric_values.get("K值")
    d_value = metric_values.get("D值")

    def _trend_vs_ma(ma_name: str, ma_value: float | None) -> str:
        if current_price is None or ma_value is None:
            return f"{ma_name} 是对应周期均线，用于判断该周期趋势方向与支撑/压力。"
        if current_price > ma_value:
            return f"当前价高于 {ma_name}，该周期趋势偏强，回踩 {ma_name} 常作为支撑位观察。"
        if current_price < ma_value:
            return f"当前价低于 {ma_name}，该周期趋势偏弱，{ma_name} 更可能形成上方压力。"
        return f"当前价接近 {ma_name}，多空在该周期均衡，需结合成交量确认方向。"

    if metric_name.endswith("打分"):
        if metric_value is None:
            return "该项为单因子投票分，正值偏多、负值偏空，绝对值越大影响越大。"
        if metric_value > 0:
            return f"该因子投票分为正({metric_value:+.4f})，对最终买入方向提供增量支持。"
        if metric_value < 0:
            return f"该因子投票分为负({metric_value:+.4f})，对最终卖出/谨慎方向提供增量支持。"
        return "该因子投票分接近 0，对最终决策影响中性。"

    if metric_name == "现价":
        if current_price is None or ma20 is None:
            return "现价是决策时点的成交参考价，用于与均线和阈值比较。"
        if current_price > ma20:
            return f"现价高于 MA20（{ma20:.2f}），中期趋势仍偏强。"
        if current_price < ma20:
            return f"现价低于 MA20（{ma20:.2f}），中期趋势转弱，需防回撤扩大。"
        return f"现价与 MA20（{ma20:.2f}）接近，中期方向尚不明确。"

    if metric_name == "成本":
        if current_price is None or metric_value is None:
            return "成本用于衡量当前仓位盈亏与风控空间。"
        pnl = (current_price - metric_value) / metric_value * 100 if metric_value else 0.0
        if pnl >= 0:
            return f"按当前价估算浮盈约 {pnl:.2f}%，可结合止盈阈值评估是否继续持有。"
        return f"按当前价估算浮亏约 {abs(pnl):.2f}%，需优先关注止损纪律。"

    if metric_upper in {"MA5", "MA10", "MA20", "MA60"}:
        return _trend_vs_ma(metric_upper, metric_value)

    if metric_upper in {"RSI", "RSI12"}:
        if metric_value is None:
            return "RSI 反映价格动量强弱，常用 30/70 识别超卖/超买。"
        if metric_value >= 70:
            return f"RSI={metric_value:.2f} 处于偏高区，短线可能过热，追高性价比下降。"
        if metric_value <= 30:
            return f"RSI={metric_value:.2f} 处于偏低区，短线超卖，需观察是否出现止跌信号。"
        return f"RSI={metric_value:.2f} 位于中性区间，动量未到极端。"

    if metric_upper == "MACD":
        if metric_value is None:
            return "MACD 衡量趋势动量，正值偏多、负值偏空。"
        if metric_value > 0:
            return f"MACD={metric_value:.4f} 为正，动量结构偏多。"
        if metric_value < 0:
            return f"MACD={metric_value:.4f} 为负，动量结构偏空。"
        return "MACD 接近 0，趋势动量处于切换边缘。"

    if metric_name == "信号线":
        return "信号线用于和 MACD 做交叉判断，MACD 上穿信号线通常视为动量改善。"

    if metric_name == "布林上轨":
        if current_price is None or metric_value is None:
            return "布林上轨代表近期波动上边界，接近时通常意味着波动与回撤风险加大。"
        if current_price >= metric_value:
            return "现价触及/接近布林上轨，短线容易出现震荡或回落。"
        return "现价低于布林上轨，仍有上行空间但需关注量能是否匹配。"

    if metric_name == "布林下轨":
        if current_price is None or metric_value is None:
            return "布林下轨代表近期波动下边界，接近时需观察是否出现止跌信号。"
        if current_price <= metric_value:
            return "现价触及/接近布林下轨，短线可能超跌，需结合成交量确认反弹有效性。"
        return "现价高于布林下轨，价格仍处正常波动带内。"

    if metric_name == "K值":
        if metric_value is None:
            return "K 值是 KDJ 的快线，对短周期波动较敏感。"
        if d_value is None:
            return f"K 值为 {metric_value:.2f}，用于观察短线动量强弱。"
        if metric_value > d_value:
            return f"K({metric_value:.2f}) 高于 D({d_value:.2f})，短线动量偏强。"
        if metric_value < d_value:
            return f"K({metric_value:.2f}) 低于 D({d_value:.2f})，短线动量偏弱。"
        return f"K 与 D 均约 {metric_value:.2f}，短线方向暂不明显。"

    if metric_name == "D值":
        if metric_value is None:
            return "D 值是 KDJ 的慢线，用于平滑短线噪音。"
        if k_value is None:
            return f"D 值为 {metric_value:.2f}，可配合 K 值判断拐点。"
        if k_value > metric_value:
            return f"K({k_value:.2f}) 上于 D({metric_value:.2f})，短线结构偏多。"
        if k_value < metric_value:
            return f"K({k_value:.2f}) 下于 D({metric_value:.2f})，短线结构偏空。"
        return "K 与 D 重合，短线方向等待进一步确认。"

    if metric_name == "量比":
        if metric_value is None:
            return "量比反映当前成交活跃度，相对 1 越高说明放量越明显。"
        if metric_value >= 1.5:
            return f"量比={metric_value:.2f}，成交明显放大，信号有效性通常更高。"
        if metric_value <= 0.8:
            return f"量比={metric_value:.2f}，成交偏弱，趋势延续性需要谨慎评估。"
        return f"量比={metric_value:.2f}，成交活跃度处于常态区间。"

    if metric_name == "成交量":
        avg_volume = metric_values.get("5日均量")
        if metric_value is None:
            return "成交量是当前周期真实成交规模，用于验证价格信号是否有资金参与。"
        if avg_volume is None or avg_volume == 0:
            return "成交量用于验证价格动作的资金参与强度，需配合均量或量比判断。"
        ratio = metric_value / avg_volume
        if ratio >= 1.5:
            return f"成交量约为5日均量的 {ratio:.2f} 倍，属于放量，信号可信度更高。"
        if ratio <= 0.8:
            return f"成交量约为5日均量的 {ratio:.2f} 倍，属于缩量，趋势延续需谨慎。"
        return f"成交量约为5日均量的 {ratio:.2f} 倍，量能处于常态区间。"

    if metric_name in {"5日均量", "五日均量", "VOL5"}:
        return "5日均量用于给当前成交量提供基准，判断是放量突破还是缩量震荡。"

    if metric_name == "换手率":
        if metric_value is None:
            return "换手率用于衡量筹码交换强度和交易拥挤程度。"
        if metric_value >= 8:
            return f"换手率={metric_value:.2f}% 偏高，资金博弈激烈，波动风险同步升高。"
        if metric_value <= 1:
            return f"换手率={metric_value:.2f}% 偏低，流动性一般，趋势推进通常较慢。"
        return f"换手率={metric_value:.2f}% 处于常态区间。"

    if metric_name == "成交额":
        if metric_value is None:
            return "成交额用于衡量资金绝对规模，常与成交量、换手率联动观察。"
        if metric_value > 0:
            return f"成交额={_txt(value)}，可与历史均值对比判断资金是否持续流入。"
        return "成交额接近 0，说明资金参与度较低。"

    if metric_name == "流动性打分":
        if metric_value is None:
            return "流动性打分来自环境轨，对成交活跃度与可交易性进行量化。"
        if metric_value > 0:
            return f"流动性打分为正({metric_value:+.4f})，说明成交环境支持信号执行。"
        if metric_value < 0:
            return f"流动性打分为负({metric_value:+.4f})，说明成交环境偏弱，执行应更保守。"
        return "流动性打分为中性，对决策影响有限。"

    if metric_name == "浮盈亏":
        if metric_value is None:
            return "浮盈亏用于评估持仓安全垫与止盈止损空间。"
        if metric_value >= 0:
            return f"当前浮盈 {metric_value:.2f}%，可结合回撤容忍度动态止盈。"
        return f"当前浮亏 {abs(metric_value):.2f}%，应优先遵守止损规则。"

    if note:
        return f"该指标来自决策时的原始说明：{note}"
    if source == "tech_vote":
        return "该指标来自技术投票子模型的直接打分输出。"
    if source == "tech_vote_reason":
        return "该指标来自技术投票理由中的数值抽取，用于还原投票依据。"
    if source == "reasoning":
        return "该指标来自决策文本中的显式数值，已结构化用于复盘。"
    return "该指标用于补充决策依据。"
