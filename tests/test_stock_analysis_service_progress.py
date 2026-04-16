from types import SimpleNamespace
import time

import pandas as pd

import app.stock_analysis_service as service


def test_analyze_single_stock_for_batch_reports_progress(monkeypatch):
    progress_events: list[tuple[str, str, int | None]] = []

    stock_info = {"symbol": "002463", "name": "沪电股份", "current_price": 89.99}
    stock_data = pd.DataFrame(
        [{"Close": 88.5}, {"Close": 89.99}],
        index=pd.to_datetime(["2026-04-11", "2026-04-12"]),
    )
    indicators = {"rsi": 71.32, "ma20": 82.99, "volume_ratio": 1.22, "macd": 2.118}

    monkeypatch.setattr(service, "get_stock_data", lambda symbol, period: (stock_info, stock_data, indicators))

    class FakeFetcher:
        def get_financial_data(self, symbol):
            return {"roe": 18.2}

        def _is_chinese_stock(self, symbol):
            return True

        def get_risk_data(self, symbol):
            return {"risk": "medium"}

    monkeypatch.setattr(service, "StockDataFetcher", lambda: FakeFetcher())

    class FakeAgents:
        def run_multi_agent_analysis(
            self,
            stock_info,
            stock_data,
            indicators,
            financial_data=None,
            fund_flow_data=None,
            sentiment_data=None,
            news_data=None,
            quarterly_data=None,
            risk_data=None,
            enabled_analysts=None,
            progress_callback=None,
        ):
            if progress_callback:
                progress_callback("analyst", "正在生成技术分析师观点", 48)
            return {"technical": {"agent_name": "技术分析师", "analysis": "趋势偏强"}}

        def conduct_team_discussion(self, agents_results, stock_info):
            return "团队讨论完成"

        def make_final_decision(self, discussion_result, stock_info, indicators):
            return {"decision_text": "建议继续观察"}

    monkeypatch.setattr(service, "StockAnalysisAgents", lambda model=None: FakeAgents())
    monkeypatch.setattr(service.db, "save_analysis", lambda **kwargs: None)

    result = service.analyze_single_stock_for_batch(
        "002463",
        "1y",
        progress_callback=lambda stage, message, progress=None: progress_events.append((stage, message, progress)),
    )

    assert result["success"] is True
    messages = [message for _, message, _ in progress_events]
    assert "正在获取行情与基础信息" in messages
    assert "正在补充财务与资金面数据" in messages
    assert "正在生成技术分析师观点" in messages
    assert "正在组织团队讨论" in messages
    assert "正在生成最终决策" in messages
    assert "正在保存分析结果" in messages


def test_analyze_single_stock_for_batch_limits_slow_enrichment_sources(monkeypatch):
    progress_events: list[tuple[str, str, int | None]] = []
    captured: dict[str, object] = {}

    stock_info = {"symbol": "002463", "name": "沪电股份", "current_price": 89.99}
    stock_data = pd.DataFrame(
        [{"Close": 88.5}, {"Close": 89.99}],
        index=pd.to_datetime(["2026-04-11", "2026-04-12"]),
    )
    indicators = {"rsi": 71.32, "ma20": 82.99, "volume_ratio": 1.22, "macd": 2.118}

    monkeypatch.setattr(service, "get_stock_data", lambda symbol, period: (stock_info, stock_data, indicators))
    monkeypatch.setattr(service.config, "EXTERNAL_DATA_TASK_TIMEOUT_SECONDS", 0.05)

    class FakeFetcher:
        def get_financial_data(self, symbol):
            time.sleep(0.2)
            return {"roe": 18.2}

        def _is_chinese_stock(self, symbol):
            return True

        def get_risk_data(self, symbol):
            time.sleep(0.2)
            return {"risk": "medium"}

    monkeypatch.setattr(service, "StockDataFetcher", lambda: FakeFetcher())

    import app.quarterly_report_data as quarterly_module
    import app.fund_flow_akshare as fund_flow_module

    class SlowQuarterlyFetcher:
        def get_quarterly_reports(self, symbol):
            time.sleep(0.2)
            return {"data_success": True}

    class SlowFundFlowFetcher:
        def get_fund_flow_data(self, symbol):
            time.sleep(0.2)
            return {"data_success": True}

    monkeypatch.setattr(quarterly_module, "QuarterlyReportDataFetcher", lambda: SlowQuarterlyFetcher())
    monkeypatch.setattr(fund_flow_module, "FundFlowAkshareDataFetcher", lambda: SlowFundFlowFetcher())

    class FakeAgents:
        def run_multi_agent_analysis(
            self,
            stock_info,
            stock_data,
            indicators,
            financial_data=None,
            fund_flow_data=None,
            sentiment_data=None,
            news_data=None,
            quarterly_data=None,
            risk_data=None,
            enabled_analysts=None,
            progress_callback=None,
        ):
            captured["financial_data"] = financial_data
            captured["fund_flow_data"] = fund_flow_data
            captured["quarterly_data"] = quarterly_data
            captured["risk_data"] = risk_data
            return {"technical": {"agent_name": "技术分析师", "analysis": "趋势偏强"}}

        def conduct_team_discussion(self, agents_results, stock_info):
            return "团队讨论完成"

        def make_final_decision(self, discussion_result, stock_info, indicators):
            return {"decision_text": "建议继续观察"}

    monkeypatch.setattr(service, "StockAnalysisAgents", lambda model=None: FakeAgents())
    monkeypatch.setattr(service.db, "save_analysis", lambda **kwargs: None)

    start = time.perf_counter()
    result = service.analyze_single_stock_for_batch(
        "002463",
        "1y",
        progress_callback=lambda stage, message, progress=None: progress_events.append((stage, message, progress)),
    )
    elapsed = time.perf_counter() - start

    assert result["success"] is True
    assert elapsed < 0.35
    assert captured["financial_data"] is None
    assert captured["fund_flow_data"] is None
    assert captured["quarterly_data"] is None
    assert "risk_data" in captured
    assert any("部分补充数据获取较慢" in message for _, message, _ in progress_events)
