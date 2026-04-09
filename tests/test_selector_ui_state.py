from types import SimpleNamespace

import pandas as pd

import selector_ui_state as state


def test_save_and_load_simple_selector_state_round_trips_latest_result(tmp_path):
    stocks_df = pd.DataFrame(
        [
            {"股票代码": "600000.SH", "股票简称": "浦发银行", "最新价": 10.52},
            {"股票代码": "000001.SZ", "股票简称": "平安银行", "最新价": 12.34},
        ]
    )

    state.save_simple_selector_state(
        strategy_key="profit_growth",
        stocks_df=stocks_df,
        selected_at="2026-04-09 09:00:00",
        base_dir=tmp_path,
    )

    restored_df, restored_at = state.load_simple_selector_state(
        "profit_growth",
        base_dir=tmp_path,
    )

    assert restored_at == "2026-04-09 09:00:00"
    assert restored_df.to_dict(orient="records") == stocks_df.to_dict(orient="records")


def test_load_simple_selector_state_returns_none_when_missing(tmp_path):
    restored_df, restored_at = state.load_simple_selector_state("small_cap", base_dir=tmp_path)

    assert restored_df is None
    assert restored_at is None


def test_save_and_load_main_force_state_restores_analyzer_without_auto_sync_payload(tmp_path):
    raw_stocks = pd.DataFrame(
        [
            {"股票代码": "600000.SH", "股票简称": "浦发银行", "区间主力资金流向": 123456789},
        ]
    )
    analyzer = SimpleNamespace(
        raw_stocks=raw_stocks,
        fund_flow_analysis="资金分析",
        industry_analysis="行业分析",
        fundamental_analysis="基本面分析",
    )
    result = {
        "success": True,
        "total_stocks": 10,
        "filtered_stocks": 3,
        "final_recommendations": [
            {"rank": 1, "symbol": "600000.SH", "name": "浦发银行", "highlights": "资金面突出"}
        ],
        "quant_sim_sync": {"success_count": 3},
    }

    state.save_main_force_state(
        result=result,
        analyzer=analyzer,
        selected_at="2026-04-09 09:30:00",
        base_dir=tmp_path,
    )

    restored_result, restored_analyzer, restored_at = state.load_main_force_state(base_dir=tmp_path)

    assert restored_at == "2026-04-09 09:30:00"
    assert restored_result["success"] is True
    assert "quant_sim_sync" not in restored_result
    assert restored_analyzer.raw_stocks.to_dict(orient="records") == raw_stocks.to_dict(orient="records")
    assert restored_analyzer.fund_flow_analysis == "资金分析"
    assert restored_analyzer.industry_analysis == "行业分析"
    assert restored_analyzer.fundamental_analysis == "基本面分析"
