import threading
import time

import pandas as pd

import main_force_analysis as mfa


class DummyAgents:
    def __init__(self, model=None):
        self.deepseek_client = object()


def _build_sample_df():
    return pd.DataFrame(
        {
            "股票代码": ["000001"],
            "股票简称": ["平安银行"],
            "所属同花顺行业": ["银行"],
            "总市值": [100.0],
            "区间涨跌幅:前复权": [3.2],
            "区间主力资金流向": [123456789],
        }
    )


def _build_analyzer(monkeypatch):
    monkeypatch.setattr(mfa, "StockDataFetcher", lambda: object())
    monkeypatch.setattr(mfa, "StockAnalysisAgents", DummyAgents)
    analyzer = mfa.MainForceAnalyzer(model="test-model")
    sample = _build_sample_df()
    monkeypatch.setattr(
        analyzer.selector,
        "get_main_force_stocks",
        lambda **kwargs: (True, sample, "ok"),
    )
    monkeypatch.setattr(
        analyzer.selector,
        "filter_stocks",
        lambda *args, **kwargs: sample,
    )
    monkeypatch.setattr(analyzer, "_prepare_overall_summary", lambda df: "summary")
    monkeypatch.setattr(
        analyzer,
        "_select_best_stocks",
        lambda *args, **kwargs: [
            {
                "rank": 1,
                "symbol": "000001",
                "name": "平安银行",
                "reasons": ["主力资金净流入较多"],
                "highlights": "资金面突出",
                "risks": "需关注回撤",
                "position": "20%",
                "investment_period": "中期",
            }
        ],
    )
    return analyzer


def test_run_full_analysis_reports_progress(monkeypatch):
    analyzer = _build_analyzer(monkeypatch)
    monkeypatch.setattr(analyzer, "_fund_flow_overall_analysis", lambda *args: "fund")
    monkeypatch.setattr(analyzer, "_industry_overall_analysis", lambda *args: "industry")
    monkeypatch.setattr(analyzer, "_fundamental_overall_analysis", lambda *args: "fundamental")

    progress_updates = []

    result = analyzer.run_full_analysis(
        start_date="2026年1月1日",
        final_n=1,
        max_range_change=30,
        min_market_cap=50,
        max_market_cap=5000,
        progress_callback=lambda percent, message: progress_updates.append((percent, message)),
    )

    assert result["success"] is True
    assert progress_updates
    assert progress_updates[0] == (5, "正在获取主力资金候选股...")
    assert progress_updates[-1] == (100, "主力选股分析完成")
    progress_values = [percent for percent, _ in progress_updates]
    assert progress_values == sorted(progress_values)
    assert any(message == "正在并行生成三份AI分析报告..." for _, message in progress_updates)
    assert any(message == "资金流向分析已完成" for _, message in progress_updates)
    assert any(message == "行业板块分析已完成" for _, message in progress_updates)
    assert any(message == "财务基本面分析已完成" for _, message in progress_updates)


def test_run_full_analysis_parallelizes_three_ai_reports(monkeypatch):
    analyzer = _build_analyzer(monkeypatch)
    state = {"running": 0, "max_running": 0, "started": 0}
    lock = threading.Lock()
    started_event = threading.Event()

    def overlap_and_return(value):
        def _inner(*args, **kwargs):
            with lock:
                state["started"] += 1
                state["running"] += 1
                state["max_running"] = max(state["max_running"], state["running"])
                if state["started"] == 3:
                    started_event.set()
            started_event.wait(timeout=1)
            time.sleep(0.05)
            with lock:
                state["running"] -= 1
            return value

        return _inner

    monkeypatch.setattr(analyzer, "_fund_flow_overall_analysis", overlap_and_return("fund"))
    monkeypatch.setattr(analyzer, "_industry_overall_analysis", overlap_and_return("industry"))
    monkeypatch.setattr(analyzer, "_fundamental_overall_analysis", overlap_and_return("fundamental"))

    result = analyzer.run_full_analysis(
        start_date="2026年1月1日",
        final_n=1,
        max_range_change=30,
        min_market_cap=50,
        max_market_cap=5000,
    )

    assert result["success"] is True
    assert state["max_running"] >= 2
