import app.main_force_ui as mfui


def test_sync_main_force_recommendations_to_watchlist_adds_each_recommendation(monkeypatch):
    captured_calls = []

    def fake_add_stock_to_watchlist(**kwargs):
        captured_calls.append(kwargs)
        return True, f"ok-{kwargs['stock_code']}", 1

    monkeypatch.setattr(mfui, "add_stock_to_watchlist", fake_add_stock_to_watchlist)

    summary = mfui.sync_main_force_recommendations_to_watchlist(
        [
            {
                "rank": 1,
                "symbol": "600000.SH",
                "name": "浦发银行",
                "highlights": "资金面突出",
                "stock_data": {
                    "股票代码": "600000.SH",
                    "股票简称": "浦发银行",
                    "最新价": 10.52,
                },
            },
            {
                "rank": 2,
                "symbol": "000001.SZ",
                "name": "平安银行",
                "highlights": "估值合理",
                "stock_data": {
                    "股票代码": "000001.SZ",
                    "股票简称": "平安银行",
                    "股价": 12.34,
                },
            },
        ]
    )

    assert summary["attempted"] == 2
    assert summary["success_count"] == 2
    assert not summary["failures"]
    assert [call["stock_code"] for call in captured_calls] == ["600000", "000001"]
    assert [call["latest_price"] for call in captured_calls] == [10.52, 12.34]
    assert all(call["source"] == "main_force" for call in captured_calls)
    assert "主力选股第1名" in captured_calls[0]["notes"]


def test_sync_main_force_recommendations_to_watchlist_collects_failures(monkeypatch):
    def fake_add_stock_to_watchlist(**kwargs):
        if kwargs["stock_code"] == "600000":
            return False, "db error", 0
        return True, "ok", 1

    monkeypatch.setattr(mfui, "add_stock_to_watchlist", fake_add_stock_to_watchlist)

    summary = mfui.sync_main_force_recommendations_to_watchlist(
        [
            {
                "rank": 1,
                "symbol": "600000.SH",
                "name": "浦发银行",
                "stock_data": {"股票代码": "600000.SH", "股票简称": "浦发银行"},
            },
            {
                "rank": 2,
                "symbol": "BAD",
                "name": "",
                "stock_data": {},
            },
        ]
    )

    assert summary["attempted"] == 1
    assert summary["success_count"] == 0
    assert summary["failures"] == ["600000: db error"]
