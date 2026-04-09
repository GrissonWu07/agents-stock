from types import SimpleNamespace

import pandas as pd

import selector_result_store as store


def test_save_and_load_latest_result_round_trips_nested_dataframes(tmp_path):
    payload = {
        "selected_at": "2026-04-09 08:00:00",
        "stocks_df": pd.DataFrame(
            [
                {"股票代码": "600000.SH", "股票简称": "浦发银行", "最新价": 10.52},
                {"股票代码": "000001.SZ", "股票简称": "平安银行", "最新价": 12.34},
            ]
        ),
        "analyzer_state": {
            "raw_stocks": pd.DataFrame(
                [{"股票代码": "600000.SH", "股票简称": "浦发银行"}]
            ),
            "fund_flow_analysis": "资金报告",
        },
        "result": {
            "success": True,
            "final_recommendations": [
                {"symbol": "600000.SH", "name": "浦发银行"},
            ],
        },
    }

    store.save_latest_result("main_force", payload, base_dir=tmp_path)
    restored = store.load_latest_result("main_force", base_dir=tmp_path)

    assert restored["selected_at"] == payload["selected_at"]
    assert restored["result"] == payload["result"]
    assert restored["stocks_df"].to_dict(orient="records") == payload["stocks_df"].to_dict(orient="records")
    assert restored["analyzer_state"]["raw_stocks"].to_dict(orient="records") == [
        {"股票代码": "600000.SH", "股票简称": "浦发银行"}
    ]
    assert restored["analyzer_state"]["fund_flow_analysis"] == "资金报告"


def test_load_latest_result_returns_none_when_missing(tmp_path):
    assert store.load_latest_result("small_cap", base_dir=tmp_path) is None
