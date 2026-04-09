"""Selector-facing helpers for adding stocks into quant simulation."""

from __future__ import annotations

from pathlib import Path
from typing import Optional
import pandas as pd

from quant_sim.candidate_pool_service import CandidatePoolService
from quant_sim.db import DEFAULT_DB_FILE


def normalize_stock_code(stock_code: str) -> str:
    """Normalize selector output like 600000.SH -> 600000."""
    if not stock_code:
        return ""

    normalized = str(stock_code).strip().upper()
    for delimiter in (".", " "):
        if delimiter in normalized:
            normalized = normalized.split(delimiter)[0]
    return normalized


def add_stock_to_quant_sim(
    stock_code: str,
    stock_name: str,
    source: str,
    latest_price: Optional[float] = None,
    notes: Optional[str] = None,
    db_file: str | Path = DEFAULT_DB_FILE,
) -> tuple[bool, str, int]:
    """Add one selected stock into the shared quant simulation candidate pool."""

    normalized_code = normalize_stock_code(stock_code)
    if not normalized_code or not stock_name:
        return False, "股票代码或名称为空，无法加入量化模拟。", 0

    service = CandidatePoolService(db_file=db_file)
    candidate_id = service.add_manual_candidate(
        stock_code=normalized_code,
        stock_name=stock_name,
        source=source,
        latest_price=latest_price,
        notes=notes,
    )
    return True, f"✅ {normalized_code} - {stock_name} 已加入量化模拟", candidate_id


def extract_latest_price_from_row(row: dict | pd.Series) -> Optional[float]:
    """Extract the best-effort latest price from a selector row."""
    for field_name in ("最新价", "股价"):
        value = row.get(field_name)
        try:
            if value is not None and not pd.isna(value):
                return float(value)
        except (TypeError, ValueError):
            continue
    return None


def sync_selector_dataframe_to_quant_sim(
    stocks_df: pd.DataFrame,
    source: str,
    note_prefix: Optional[str] = None,
    db_file: str | Path = DEFAULT_DB_FILE,
) -> dict[str, object]:
    """Sync a selector dataframe into the shared quant-sim candidate pool."""

    summary = {
        "attempted": 0,
        "success_count": 0,
        "failures": [],
    }

    if stocks_df is None or stocks_df.empty:
        return summary

    for _, row in stocks_df.iterrows():
        stock_code = normalize_stock_code(row.get("股票代码"))
        stock_name = str(row.get("股票简称", "") or "").strip()
        if not stock_code or not stock_name:
            continue

        summary["attempted"] += 1
        success, message, _ = add_stock_to_quant_sim(
            stock_code=stock_code,
            stock_name=stock_name,
            source=source,
            latest_price=extract_latest_price_from_row(row),
            notes=note_prefix,
            db_file=db_file,
        )
        if success:
            summary["success_count"] += 1
        else:
            summary["failures"].append(f"{stock_code}: {message}")

    return summary
