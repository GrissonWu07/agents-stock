"""Application package root for business code."""

from importlib import import_module

def __getattr__(name: str):
    if name == "main":
        return import_module("app.app").main
    if name in {
        "StockDataFetcher",
        "get_stock_data",
        "calculate_key_indicators",
        "build_indicator_explanations",
    }:
        return getattr(import_module("app.app"), name)
    raise AttributeError(name)
    return getattr(_app_module, name)
