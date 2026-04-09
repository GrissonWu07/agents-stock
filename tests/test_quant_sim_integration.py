import pandas as pd

from quant_sim import integration


def test_sync_selector_dataframe_to_quant_sim_adds_valid_rows(monkeypatch):
    captured = []

    def fake_add_stock_to_quant_sim(**kwargs):
        captured.append(kwargs)
        return True, "ok", 1

    monkeypatch.setattr(integration, "add_stock_to_quant_sim", fake_add_stock_to_quant_sim)

    summary = integration.sync_selector_dataframe_to_quant_sim(
        pd.DataFrame(
            [
                {"股票代码": "600000.SH", "股票简称": "浦发银行", "最新价": 10.52},
                {"股票代码": "000001.SZ", "股票简称": "平安银行", "股价": 12.34},
                {"股票代码": "", "股票简称": "空代码"},
            ]
        ),
        source="profit_growth",
        note_prefix="净利增长",
    )

    assert summary == {"attempted": 2, "success_count": 2, "failures": []}
    assert [item["stock_code"] for item in captured] == ["600000", "000001"]
    assert [item["latest_price"] for item in captured] == [10.52, 12.34]
    assert all(item["source"] == "profit_growth" for item in captured)
    assert all(item["notes"] == "净利增长" for item in captured)


def test_sync_selector_dataframe_to_quant_sim_collects_failures(monkeypatch):
    def fake_add_stock_to_quant_sim(**kwargs):
        if kwargs["stock_code"] == "600000":
            return False, "db error", 0
        return True, "ok", 1

    monkeypatch.setattr(integration, "add_stock_to_quant_sim", fake_add_stock_to_quant_sim)

    summary = integration.sync_selector_dataframe_to_quant_sim(
        pd.DataFrame(
            [
                {"股票代码": "600000.SH", "股票简称": "浦发银行"},
                {"股票代码": None, "股票简称": "无效"},
            ]
        ),
        source="low_price_bull",
        note_prefix="低价擒牛",
    )

    assert summary == {
        "attempted": 1,
        "success_count": 0,
        "failures": ["600000: db error"],
    }


def test_sync_selector_dataframe_to_quant_sim_forwards_normalized_metadata(monkeypatch):
    captured = []

    def fake_add_stock_to_quant_sim(**kwargs):
        captured.append(kwargs)
        return True, "ok", 1

    monkeypatch.setattr(integration, "add_stock_to_quant_sim", fake_add_stock_to_quant_sim)

    integration.sync_selector_dataframe_to_quant_sim(
        pd.DataFrame(
            [
                {
                    "股票代码": "300390.SZ",
                    "股票简称": "天华新能",
                    "最新价": 61.99,
                    "净利润增长率": 35.0,
                    "净资产收益率": 19.0,
                    "市盈率": 18.0,
                    "市净率": 2.1,
                    "所属行业": "锂电池",
                    "总市值": 123456789.0,
                }
            ]
        ),
        source="profit_growth",
    )

    assert captured[0]["metadata"] == {
        "profit_growth_pct": 35.0,
        "roe_pct": 19.0,
        "pe_ratio": 18.0,
        "pb_ratio": 2.1,
        "industry": "锂电池",
        "market_cap": 123456789.0,
    }
