"""Timezone helpers for quant simulation persistence and scheduling."""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo


MARKET_TIMEZONES = {
    "CN": "Asia/Shanghai",
    "HK": "Asia/Hong_Kong",
    "US": "America/New_York",
}


def market_timezone_name(market: str | None) -> str:
    return MARKET_TIMEZONES.get(str(market or "CN").upper(), MARKET_TIMEZONES["CN"])


def market_timezone(market: str | None) -> ZoneInfo:
    return ZoneInfo(market_timezone_name(market))


def ensure_utc_datetime(value: str | datetime | None = None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc).replace(microsecond=0)
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip()
        if text.endswith("Z"):
            text = f"{text[:-1]}+00:00"
        elif "T" not in text and "+" not in text:
            text = text.replace(" ", "T")
        dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(microsecond=0)


def format_utc_iso_z(value: str | datetime | None = None) -> str:
    return ensure_utc_datetime(value).isoformat(timespec="seconds").replace("+00:00", "Z")


def format_market_iso(value: str | datetime | None, market: str | None) -> str:
    return ensure_utc_datetime(value).astimezone(market_timezone(market)).isoformat(timespec="seconds")


def utc_now_iso_z() -> str:
    return format_utc_iso_z()
