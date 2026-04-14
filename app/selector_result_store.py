"""Persistence helpers for keeping the latest selector results across sessions."""

from __future__ import annotations

import json
from datetime import date, datetime
from io import StringIO
from pathlib import Path
from typing import Any

import pandas as pd

from app.runtime_paths import DATA_DIR

DEFAULT_SELECTOR_RESULT_DIR = DATA_DIR / "selector_results"


def save_latest_result(strategy_key: str, payload: dict[str, Any], base_dir: str | Path = DEFAULT_SELECTOR_RESULT_DIR) -> Path:
    """Persist the latest selector result for a strategy."""
    base_path = Path(base_dir)
    base_path.mkdir(parents=True, exist_ok=True)
    file_path = base_path / f"{strategy_key}.json"
    file_path.write_text(
        json.dumps(_encode_value(payload), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return file_path


def load_latest_result(strategy_key: str, base_dir: str | Path = DEFAULT_SELECTOR_RESULT_DIR) -> dict[str, Any] | None:
    """Load the latest selector result for a strategy."""
    file_path = Path(base_dir) / f"{strategy_key}.json"
    if not file_path.exists():
        return None
    return _decode_value(json.loads(file_path.read_text(encoding="utf-8")))


def _encode_value(value: Any) -> Any:
    if isinstance(value, pd.DataFrame):
        return {
            "__type__": "dataframe",
            "value": value.to_json(orient="split", force_ascii=False),
        }
    if isinstance(value, pd.Series):
        return {
            "__type__": "series",
            "value": value.to_json(force_ascii=False),
        }
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.replace(microsecond=0).isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    if hasattr(value, "item") and callable(value.item):
        try:
            return _encode_value(value.item())
        except (TypeError, ValueError):
            pass
    if isinstance(value, dict):
        return {key: _encode_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_encode_value(item) for item in value]
    if isinstance(value, tuple):
        return {"__type__": "tuple", "value": [_encode_value(item) for item in value]}
    return value


def _decode_value(value: Any) -> Any:
    if isinstance(value, dict):
        if value.get("__type__") == "dataframe":
            return pd.read_json(StringIO(value["value"]), orient="split")
        if value.get("__type__") == "series":
            return pd.read_json(StringIO(value["value"]), typ="series")
        if value.get("__type__") == "tuple":
            return tuple(_decode_value(item) for item in value["value"])
        return {key: _decode_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_decode_value(item) for item in value]
    return value
