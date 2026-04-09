import pandas as pd

from batch_deep_analysis import (
    enrich_batch_result_metadata,
    extract_batch_candidates,
    run_batch_deep_analysis,
    sort_main_force_batch_candidates,
)


def test_extract_batch_candidates_normalizes_codes_and_limits_rows():
    stocks_df = pd.DataFrame(
        [
            {"股票代码": "600000.SH", "股票简称": "浦发银行"},
            {"股票代码": "000001.SZ", "股票简称": "平安银行"},
            {"股票代码": "", "股票简称": "空代码"},
        ]
    )

    candidates = extract_batch_candidates(stocks_df, limit=2)

    assert candidates == [
        {"symbol": "600000", "name": "浦发银行"},
        {"symbol": "000001", "name": "平安银行"},
    ]


def test_sort_main_force_batch_candidates_uses_main_fund_column_descending():
    stocks_df = pd.DataFrame(
        [
            {"股票代码": "600000.SH", "股票简称": "浦发银行", "区间主力资金流向": 10},
            {"股票代码": "000001.SZ", "股票简称": "平安银行", "区间主力资金流向": 30},
            {"股票代码": "601318.SH", "股票简称": "中国平安", "区间主力资金流向": 20},
        ]
    )

    sorted_df = sort_main_force_batch_candidates(stocks_df)

    assert list(sorted_df["股票代码"]) == ["000001.SZ", "601318.SH", "600000.SH"]


def test_run_batch_deep_analysis_collects_results_and_stats():
    candidates = [
        {"symbol": "600000", "name": "浦发银行"},
        {"symbol": "000001", "name": "平安银行"},
    ]

    def fake_analyzer(symbol, period, enabled_analysts_config=None, selected_model=None):
        return {
            "symbol": symbol,
            "success": symbol == "600000",
            "error": None if symbol == "600000" else "boom",
            "final_decision": {"rating": "买入"} if symbol == "600000" else None,
        }

    result = run_batch_deep_analysis(
        candidates=candidates,
        analysis_mode="sequential",
        max_workers=1,
        analyzer_fn=fake_analyzer,
        selected_model="demo-model",
    )

    assert result["total"] == 2
    assert result["success"] == 1
    assert result["failed"] == 1
    assert result["results"][0]["symbol"] == "600000"
    assert result["results"][1]["symbol"] == "000001"


def test_run_batch_deep_analysis_parallel_preserves_candidate_order():
    candidates = [
        {"symbol": "600000", "name": "浦发银行"},
        {"symbol": "000001", "name": "平安银行"},
    ]

    def fake_analyzer(symbol, period, enabled_analysts_config=None, selected_model=None):
        import time

        if symbol == "600000":
            time.sleep(0.05)
        return {
            "symbol": symbol,
            "success": True,
            "final_decision": {"rating": "买入"},
        }

    result = run_batch_deep_analysis(
        candidates=candidates,
        analysis_mode="parallel",
        max_workers=2,
        analyzer_fn=fake_analyzer,
        selected_model="demo-model",
    )

    assert [item["symbol"] for item in result["results"]] == ["600000", "000001"]


def test_enrich_batch_result_metadata_skips_history_for_non_main_force():
    result = enrich_batch_result_metadata(
        strategy_key="profit_growth",
        result={
            "results": [],
            "total": 0,
            "success": 0,
            "failed": 0,
            "elapsed_time": 1.2,
            "analysis_mode": "sequential",
        },
    )

    assert result["saved_to_history"] is False
    assert result["save_error"] is None
