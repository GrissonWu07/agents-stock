import os

import pandas as pd

from main_force_selector import MainForceStockSelector


PROXY_KEYS = [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
]


def test_get_main_force_stocks_temporarily_disables_proxy_env(monkeypatch):
    expected_proxy = "http://127.0.0.1:10792"
    for key in PROXY_KEYS:
        monkeypatch.setenv(key, expected_proxy)

    captured_env = {}

    def fake_get(query, loop=True, **kwargs):
        captured_env.update({key: os.environ.get(key) for key in PROXY_KEYS})
        return pd.DataFrame(
            [
                {
                    "股票代码": "600000.SH",
                    "股票简称": "浦发银行",
                }
            ]
        )

    monkeypatch.setattr("main_force_selector.pywencai.get", fake_get)

    selector = MainForceStockSelector()
    success, stocks_df, _ = selector.get_main_force_stocks(
        start_date="2026年1月8日",
        min_market_cap=50,
        max_market_cap=5000,
    )

    assert success is True
    assert not stocks_df.empty
    assert all(captured_env[key] in (None, "") for key in PROXY_KEYS)
    assert all(os.environ.get(key) == expected_proxy for key in PROXY_KEYS)


def test_get_main_force_stocks_prefers_simpler_stable_queries(monkeypatch):
    attempted_queries = []

    def fake_get(query, loop=True, **kwargs):
        attempted_queries.append(query)
        if len(attempted_queries) == 1:
            raise AttributeError("'NoneType' object has no attribute 'get'")
        return pd.DataFrame(
            [
                {
                    "股票代码": "600000.SH",
                    "股票简称": "浦发银行",
                }
            ]
        )

    monkeypatch.setattr("main_force_selector.pywencai.get", fake_get)

    selector = MainForceStockSelector()
    success, _, _ = selector.get_main_force_stocks(
        start_date="2026年1月8日",
        min_market_cap=50,
        max_market_cap=5000,
    )

    assert success is True
    assert len(attempted_queries) == 2
    assert "盈利能力评分" not in attempted_queries[0]
    assert "主力资金净流入，并计算区间涨跌幅" in attempted_queries[0]


def test_get_main_force_stocks_retries_when_result_lacks_stock_columns(monkeypatch):
    attempted_queries = []

    def fake_get(query, loop=True, **kwargs):
        attempted_queries.append(query)
        if len(attempted_queries) == 1:
            return pd.DataFrame([{"title_content": "问财摘要，不是股票表"}])
        return pd.DataFrame(
            [
                {
                    "股票代码": "600000.SH",
                    "股票简称": "浦发银行",
                }
            ]
        )

    monkeypatch.setattr("main_force_selector.pywencai.get", fake_get)

    selector = MainForceStockSelector()
    success, stocks_df, _ = selector.get_main_force_stocks(
        start_date="2026年1月8日",
        min_market_cap=50,
        max_market_cap=5000,
    )

    assert success is True
    assert len(attempted_queries) == 2
    assert "股票代码" in stocks_df.columns


def test_get_main_force_stocks_only_sleeps_for_transient_errors(monkeypatch):
    attempted_queries = []
    sleep_calls = []

    def fake_get(query, loop=True, **kwargs):
        attempted_queries.append(query)
        if len(attempted_queries) == 1:
            raise TimeoutError("read timed out")
        return pd.DataFrame(
            [
                {
                    "股票代码": "600000.SH",
                    "股票简称": "浦发银行",
                }
            ]
        )

    monkeypatch.setattr("main_force_selector.pywencai.get", fake_get)
    monkeypatch.setattr("main_force_selector.time.sleep", lambda seconds: sleep_calls.append(seconds))

    selector = MainForceStockSelector()
    success, _, _ = selector.get_main_force_stocks(
        start_date="2026年1月8日",
        min_market_cap=50,
        max_market_cap=5000,
    )

    assert success is True
    assert len(attempted_queries) == 2
    assert sleep_calls == [1]


def test_get_main_force_stocks_skips_sleep_for_non_transient_errors(monkeypatch):
    attempted_queries = []
    sleep_calls = []

    def fake_get(query, loop=True, **kwargs):
        attempted_queries.append(query)
        if len(attempted_queries) == 1:
            raise ValueError("invalid field mapping")
        return pd.DataFrame(
            [
                {
                    "股票代码": "600000.SH",
                    "股票简称": "浦发银行",
                }
            ]
        )

    monkeypatch.setattr("main_force_selector.pywencai.get", fake_get)
    monkeypatch.setattr("main_force_selector.time.sleep", lambda seconds: sleep_calls.append(seconds))

    selector = MainForceStockSelector()
    success, _, _ = selector.get_main_force_stocks(
        start_date="2026年1月8日",
        min_market_cap=50,
        max_market_cap=5000,
    )

    assert success is True
    assert len(attempted_queries) == 2
    assert sleep_calls == []
