from __future__ import annotations

import functools
import logging
import os
import random
import threading
import time
from typing import Any, Callable

import akshare as _akshare

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


AKSHARE_MAX_RETRIES = max(1, _env_int("AKSHARE_MAX_RETRIES", 3))
AKSHARE_BASIC_INFO_MAX_RETRIES = max(1, _env_int("AKSHARE_BASIC_INFO_MAX_RETRIES", 1))
AKSHARE_BASE_BACKOFF_SECONDS = max(0.0, _env_float("AKSHARE_BASE_BACKOFF_SECONDS", 0.8))
AKSHARE_MAX_BACKOFF_SECONDS = max(AKSHARE_BASE_BACKOFF_SECONDS, _env_float("AKSHARE_MAX_BACKOFF_SECONDS", 6.0))
AKSHARE_MIN_INTERVAL_SECONDS = max(0.0, _env_float("AKSHARE_MIN_INTERVAL_SECONDS", 0.35))


_CALL_LOCK = threading.Lock()
_LAST_CALL_AT = 0.0
_SHUTDOWN_EVENT = threading.Event()


def request_shutdown() -> None:
    _SHUTDOWN_EVENT.set()


def reset_shutdown() -> None:
    _SHUTDOWN_EVENT.clear()


def _throttle() -> None:
    if AKSHARE_MIN_INTERVAL_SECONDS <= 0:
        return
    global _LAST_CALL_AT
    with _CALL_LOCK:
        now = time.monotonic()
        wait = AKSHARE_MIN_INTERVAL_SECONDS - (now - _LAST_CALL_AT)
        if wait > 0:
            time.sleep(wait)
        _LAST_CALL_AT = time.monotonic()


def _max_retries_for(func: Callable[..., Any]) -> int:
    if getattr(func, "__name__", "") == "stock_individual_info_em":
        return AKSHARE_BASIC_INFO_MAX_RETRIES
    return AKSHARE_MAX_RETRIES


def _call_with_retries(func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    last_error: Exception | None = None
    max_retries = max(1, _max_retries_for(func))
    for attempt in range(1, max_retries + 1):
        try:
            _throttle()
            return func(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt >= max_retries or _SHUTDOWN_EVENT.is_set():
                break
            backoff = min(AKSHARE_MAX_BACKOFF_SECONDS, AKSHARE_BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)))
            jitter = random.uniform(0.0, 0.2)
            wait_seconds = backoff + jitter
            logger.warning(
                "[Akshare] call failed (%s), retry %s/%s in %.2fs: %s",
                getattr(func, "__name__", "unknown"),
                attempt,
                max_retries,
                wait_seconds,
                exc,
            )
            _SHUTDOWN_EVENT.wait(wait_seconds)
            if _SHUTDOWN_EVENT.is_set():
                break
    if last_error is not None:
        raise last_error
    return func(*args, **kwargs)


class AkshareProxy:
    def __init__(self, module: Any) -> None:
        self._module = module

    def __getattr__(self, name: str) -> Any:
        target = getattr(self._module, name)
        if not callable(target):
            return target

        @functools.wraps(target)
        def _wrapped(*args: Any, **kwargs: Any) -> Any:
            return _call_with_retries(target, *args, **kwargs)

        return _wrapped


ak = AkshareProxy(_akshare)


__all__ = [
    "ak",
    "AKSHARE_MAX_RETRIES",
    "AKSHARE_BASIC_INFO_MAX_RETRIES",
    "AKSHARE_BASE_BACKOFF_SECONDS",
    "AKSHARE_MAX_BACKOFF_SECONDS",
    "AKSHARE_MIN_INTERVAL_SECONDS",
    "request_shutdown",
    "reset_shutdown",
]

