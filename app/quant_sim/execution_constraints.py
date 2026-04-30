"""Trade execution constraints that model basic A-share market mechanics."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any


def trade_block_reason(
    *,
    action: str,
    stock_code: str,
    stock_name: str | None = None,
    price: float = 0.0,
    signal: dict[str, Any] | None = None,
) -> str | None:
    normalized_action = str(action or "").strip().upper()
    if normalized_action not in {"BUY", "SELL"}:
        return None

    snapshot = _extract_market_snapshot(signal)
    if not snapshot:
        return None

    if _truthy(snapshot, ("suspended", "is_suspended", "halted", "is_halted", "停牌")):
        return "停牌不可成交"
    if _has_false_tradable(snapshot):
        return "当前不可交易"
    if _has_zero_volume(snapshot):
        return "无成交量不可成交"

    trade_price = _first_float(snapshot, ("current_price", "latest_price", "price", "close", "收盘"), default=price)
    if trade_price <= 0:
        trade_price = float(price or 0.0)
    if trade_price <= 0:
        return None

    if normalized_action == "BUY" and _is_limit_up(snapshot, stock_code=stock_code, stock_name=stock_name, price=trade_price):
        return "涨停不可买入"
    if normalized_action == "SELL" and _is_limit_down(snapshot, stock_code=stock_code, stock_name=stock_name, price=trade_price):
        return "跌停不可卖出"
    return None


def _extract_market_snapshot(signal: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(signal, dict):
        return {}
    direct = signal.get("market_snapshot")
    if isinstance(direct, dict):
        return direct
    profile = signal.get("strategy_profile")
    if isinstance(profile, dict):
        snapshot = profile.get("market_snapshot")
        if isinstance(snapshot, dict):
            return snapshot
        explainability = profile.get("explainability")
        if isinstance(explainability, dict) and isinstance(explainability.get("market_snapshot"), dict):
            return explainability["market_snapshot"]
    return {}


def _is_limit_up(snapshot: dict[str, Any], *, stock_code: str, stock_name: str | None, price: float) -> bool:
    if _truthy(snapshot, ("is_limit_up", "涨停")):
        return True
    explicit_limit = _first_float(snapshot, ("limit_up_price", "limit_up", "up_limit", "涨停价"), default=0.0)
    if explicit_limit > 0:
        return price >= explicit_limit - 0.005
    prev_close = _first_float(snapshot, ("prev_close", "pre_close", "previous_close", "昨收", "前收"), default=0.0)
    if prev_close <= 0:
        return False
    return price >= _limit_price(prev_close, _limit_rate(stock_code, stock_name)) - 0.005


def _is_limit_down(snapshot: dict[str, Any], *, stock_code: str, stock_name: str | None, price: float) -> bool:
    if _truthy(snapshot, ("is_limit_down", "跌停")):
        return True
    explicit_limit = _first_float(snapshot, ("limit_down_price", "limit_down", "down_limit", "跌停价"), default=0.0)
    if explicit_limit > 0:
        return price <= explicit_limit + 0.005
    prev_close = _first_float(snapshot, ("prev_close", "pre_close", "previous_close", "昨收", "前收"), default=0.0)
    if prev_close <= 0:
        return False
    return price <= _limit_price(prev_close, -_limit_rate(stock_code, stock_name)) + 0.005


def _limit_rate(stock_code: str, stock_name: str | None) -> float:
    name = str(stock_name or "").upper()
    if "ST" in name:
        return 0.05
    code = str(stock_code or "").strip()
    if code.startswith(("300", "301", "688", "689")):
        return 0.20
    if code.startswith(("4", "8", "920")):
        return 0.30
    return 0.10


def _limit_price(prev_close: float, rate: float) -> float:
    return float((Decimal(str(prev_close)) * (Decimal("1") + Decimal(str(rate)))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _has_false_tradable(snapshot: dict[str, Any]) -> bool:
    for key in ("tradable", "is_tradable", "can_trade", "可交易"):
        if key in snapshot and not _to_bool(snapshot.get(key)):
            return True
    return False


def _has_zero_volume(snapshot: dict[str, Any]) -> bool:
    for key in ("volume", "成交量"):
        if key not in snapshot:
            continue
        value = _to_float(snapshot.get(key), default=None)
        if value is not None and value <= 0:
            return True
    return False


def _truthy(snapshot: dict[str, Any], keys: tuple[str, ...]) -> bool:
    return any(_to_bool(snapshot.get(key)) for key in keys if key in snapshot)


def _first_float(snapshot: dict[str, Any], keys: tuple[str, ...], *, default: float) -> float:
    for key in keys:
        if key not in snapshot:
            continue
        value = _to_float(snapshot.get(key), default=None)
        if value is not None:
            return value
    return float(default or 0.0)


def _to_float(value: Any, *, default: float | None) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on", "是", "停牌", "涨停", "跌停"}
    return bool(value)
