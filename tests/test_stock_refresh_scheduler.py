from app.stock_refresh_scheduler import UnifiedStockRefreshScheduler


def test_runtime_entry_fetches_required_basic_info_even_if_legacy_env_disabled(monkeypatch):
    monkeypatch.setenv("UNIFIED_STOCK_REFRESH_BASIC_INFO_ENABLED", "false")
    basic_info_calls: list[str] = []

    class FakeWatchlistService:
        def quote_fetcher(self, code, preferred_name=None):
            return {"current_price": 18.8, "name": code}

        def basic_info_fetcher(self, code):
            basic_info_calls.append(code)
            return {"name": "慢接口", "industry": "半导体"}

    entry = UnifiedStockRefreshScheduler._fetch_runtime_entry(
        watchlist_service=FakeWatchlistService(),
        stock_code="301560",
        existing=None,
    )

    assert basic_info_calls == ["301560"]
    assert entry["stock_code"] == "301560"
    assert entry["stock_name"] == "慢接口"
    assert entry["latest_price"] == 18.8
    assert entry["sector"] == "半导体"
