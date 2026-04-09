"""Persistence helpers for keeping the latest selector results across sessions."""

from __future__ import annotations

import json
from io import StringIO
from pathlib import Path
from typing import Any

import pandas as pd


DEFAULT_SELECTOR_RESULT_DIR = Path("data") / "selector_results"


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
        if value.get("__type__") == "tuple":
            return tuple(_decode_value(item) for item in value["value"])
        return {key: _decode_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_decode_value(item) for item in value]
    return value
