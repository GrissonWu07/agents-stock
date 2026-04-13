"""Helpers for persisting and restoring selector UI state."""

from __future__ import annotations

from types import SimpleNamespace
from pathlib import Path
from typing import Any

import pandas as pd

from app.selector_result_store import DEFAULT_SELECTOR_RESULT_DIR, load_latest_result, save_latest_result


def save_simple_selector_state(
    strategy_key: str,
    stocks_df: pd.DataFrame,
    selected_at: str,
    base_dir: str | Path = DEFAULT_SELECTOR_RESULT_DIR,
) -> None:
    """Persist the latest table-based selector result."""

    save_latest_result(
        strategy_key,
        {
            "stocks_df": stocks_df,
            "selected_at": selected_at,
        },
        base_dir=base_dir,
    )


def load_simple_selector_state(
    strategy_key: str,
    base_dir: str | Path = DEFAULT_SELECTOR_RESULT_DIR,
) -> tuple[pd.DataFrame | None, str | None]:
    """Restore the latest table-based selector result."""

    payload = load_latest_result(strategy_key, base_dir=base_dir)
    if not payload:
        return None, None
    return payload.get("stocks_df"), payload.get("selected_at")


def save_main_force_state(
    result: dict[str, Any],
    analyzer: Any,
    selected_at: str,
    base_dir: str | Path = DEFAULT_SELECTOR_RESULT_DIR,
) -> None:
    """Persist the latest main-force analysis result and analyzer artifacts."""

    clean_result = dict(result or {})
    clean_result.pop("quant_sim_sync", None)
    analyzer_state = {
        "raw_stocks": getattr(analyzer, "raw_stocks", None),
        "fund_flow_analysis": getattr(analyzer, "fund_flow_analysis", None),
        "industry_analysis": getattr(analyzer, "industry_analysis", None),
        "fundamental_analysis": getattr(analyzer, "fundamental_analysis", None),
    }
    save_latest_result(
        "main_force",
        {
            "result": clean_result,
            "selected_at": selected_at,
            "analyzer_state": analyzer_state,
        },
        base_dir=base_dir,
    )


def load_main_force_state(
    base_dir: str | Path = DEFAULT_SELECTOR_RESULT_DIR,
) -> tuple[dict[str, Any] | None, Any | None, str | None]:
    """Restore the latest main-force analysis result and a lightweight analyzer object."""

    payload = load_latest_result("main_force", base_dir=base_dir)
    if not payload:
        return None, None, None

    analyzer_state = payload.get("analyzer_state") or {}
    analyzer = SimpleNamespace(
        raw_stocks=analyzer_state.get("raw_stocks"),
        fund_flow_analysis=analyzer_state.get("fund_flow_analysis"),
        industry_analysis=analyzer_state.get("industry_analysis"),
        fundamental_analysis=analyzer_state.get("fundamental_analysis"),
    )
    return payload.get("result"), analyzer, payload.get("selected_at")
