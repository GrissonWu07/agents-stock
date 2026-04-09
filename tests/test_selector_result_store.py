from types import SimpleNamespace

import numpy as np
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


def test_save_latest_result_handles_numpy_and_timestamp_scalars(tmp_path):
    payload = {
        "selected_at": pd.Timestamp("2026-04-09 10:00:00"),
        "result": {
            "success": True,
            "total_stocks": np.int64(10),
            "score": np.float64(81.5),
            "final_recommendations": [
                {
                    "symbol": "600000.SH",
                    "rank": np.int64(1),
                    "stock_data": {
                        "最新价": np.float64(10.52),
                        "统计时间": pd.Timestamp("2026-04-09 10:00:00"),
                    },
                }
            ],
        },
    }

    store.save_latest_result("main_force", payload, base_dir=tmp_path)
    restored = store.load_latest_result("main_force", base_dir=tmp_path)

    assert restored["result"]["total_stocks"] == 10
    assert restored["result"]["score"] == 81.5
    assert restored["result"]["final_recommendations"][0]["rank"] == 1
    assert restored["result"]["final_recommendations"][0]["stock_data"]["最新价"] == 10.52
    assert restored["selected_at"] == "2026-04-09 10:00:00"
    assert restored["result"]["final_recommendations"][0]["stock_data"]["统计时间"] == "2026-04-09 10:00:00"


def test_default_selector_result_dir_is_repo_absolute():
    assert store.DEFAULT_SELECTOR_RESULT_DIR.is_absolute()
