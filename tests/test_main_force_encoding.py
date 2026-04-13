import pandas as pd

import app.main_force_analysis as mfa
import app.main_force_selector as mfs


class GbkStdout:
    encoding = "gbk"

    def __init__(self):
        self.buffer = []

    def write(self, text):
        text.encode(self.encoding)
        self.buffer.append(text)
        return len(text)

    def flush(self):
        return None


class DummyAgents:
    def __init__(self, model=None):
        self.deepseek_client = object()


def test_main_force_selector_handles_gbk_stdout(monkeypatch):
    fake_stdout = GbkStdout()
    sample = pd.DataFrame(
        {
            "股票代码": ["000001"],
            "股票简称": ["平安银行"],
            "所属同花顺行业": ["银行"],
            "总市值": [100.0],
            "区间涨跌幅:前复权": [3.2],
            "区间主力资金流向": [123456789],
        }
    )

    monkeypatch.setattr("sys.stdout", fake_stdout)
    monkeypatch.setattr(mfs.pywencai, "get", lambda **kwargs: sample)

    selector = mfs.MainForceStockSelector()
    success, result, _ = selector.get_main_force_stocks(
        start_date="2026年1月1日",
        min_market_cap=50,
        max_market_cap=5000,
    )

    assert success is True
    assert result is not None
    assert not result.empty
    assert fake_stdout.buffer


def test_main_force_analyzer_handles_gbk_stdout(monkeypatch):
    fake_stdout = GbkStdout()
    sample = pd.DataFrame(
        {
            "股票代码": ["000001"],
            "股票简称": ["平安银行"],
            "所属同花顺行业": ["银行"],
            "总市值": [100.0],
            "区间涨跌幅:前复权": [3.2],
            "区间主力资金流向": [123456789],
        }
    )

    monkeypatch.setattr("sys.stdout", fake_stdout)
    monkeypatch.setattr(mfa, "StockDataFetcher", lambda: object())
    monkeypatch.setattr(mfa, "StockAnalysisAgents", DummyAgents)

    analyzer = mfa.MainForceAnalyzer(model="test-model")
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
    monkeypatch.setattr(analyzer, "_fund_flow_overall_analysis", lambda *args: "fund")
    monkeypatch.setattr(analyzer, "_industry_overall_analysis", lambda *args: "industry")
    monkeypatch.setattr(analyzer, "_fundamental_overall_analysis", lambda *args: "fundamental")
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

    result = analyzer.run_full_analysis(
        start_date="2026年1月1日",
        final_n=1,
        max_range_change=30,
        min_market_cap=50,
        max_market_cap=5000,
    )

    assert result["success"] is True
    assert len(result["final_recommendations"]) == 1
    assert fake_stdout.buffer
