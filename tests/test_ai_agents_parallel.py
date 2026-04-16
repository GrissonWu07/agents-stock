import threading

import app.ai_agents as ai_agents


class _DummyClient:
    def __init__(self, model=None):
        self.model = model


def test_run_multi_agent_analysis_parallelizes_enabled_analysts(monkeypatch):
    monkeypatch.setattr(ai_agents, "DeepSeekClient", _DummyClient)
    agents = ai_agents.StockAnalysisAgents(model="test-model")

    state = {"running": 0, "max_running": 0}
    lock = threading.Lock()
    barrier = threading.Barrier(4, timeout=2)

    def overlap_and_return(label):
        def _inner(*args, **kwargs):
            with lock:
                state["running"] += 1
                state["max_running"] = max(state["max_running"], state["running"])
            try:
                barrier.wait()
                return {"agent_name": label, "analysis": f"{label}完成"}
            finally:
                with lock:
                    state["running"] -= 1

        return _inner

    monkeypatch.setattr(agents, "technical_analyst_agent", overlap_and_return("技术分析师"))
    monkeypatch.setattr(agents, "fundamental_analyst_agent", overlap_and_return("基本面分析师"))
    monkeypatch.setattr(agents, "fund_flow_analyst_agent", overlap_and_return("资金面分析师"))
    monkeypatch.setattr(agents, "risk_management_agent", overlap_and_return("风险管理师"))

    result = agents.run_multi_agent_analysis(
        stock_info={"symbol": "002463", "name": "沪电股份"},
        stock_data=[],
        indicators={"rsi": 71.32},
        financial_data={},
        fund_flow_data={},
        risk_data={},
        enabled_analysts={"technical": True, "fundamental": True, "fund_flow": True, "risk": True, "sentiment": False, "news": False},
    )

    assert set(result.keys()) == {"technical", "fundamental", "fund_flow", "risk_management"}
    assert state["max_running"] >= 2


class _RecordingClient:
    def __init__(self, model=None):
        self.model = model
        self.discussion_prompt = ""
        self.final_discussion = ""

    def call_api(self, messages, **kwargs):
        self.discussion_prompt = messages[-1]["content"]
        return "讨论完成"

    def final_decision(self, discussion_result, stock_info, indicators):
        self.final_discussion = discussion_result
        return {"decision_text": "建议继续观察"}


def test_discussion_and_final_decision_compact_long_agent_reports(monkeypatch):
    monkeypatch.setattr(ai_agents, "DeepSeekClient", _RecordingClient)
    agents = ai_agents.StockAnalysisAgents(model="test-model")

    long_text = ("趋势很强，但短线过热，需要等待回踩确认。 " * 260).strip()
    agents_results = {
        "technical": {"analysis": long_text},
        "fundamental": {"analysis": long_text},
        "fund_flow": {"analysis": long_text},
        "risk_management": {"analysis": long_text},
    }

    discussion = agents.conduct_team_discussion(agents_results, {"symbol": "002463", "name": "沪电股份"})
    decision = agents.make_final_decision(discussion, {"symbol": "002463", "name": "沪电股份"}, {"ma20": 83.57})

    assert discussion == "讨论完成"
    assert decision["decision_text"] == "建议继续观察"
    assert len(agents.deepseek_client.discussion_prompt) < len(long_text) * 2
    assert len(agents.deepseek_client.final_discussion) < len(long_text)
    assert "会议纪要" not in agents.deepseek_client.discussion_prompt
    assert "###" not in agents.deepseek_client.discussion_prompt
    assert "趋势很强" in agents.deepseek_client.discussion_prompt
    assert "会议纪要" not in agents.deepseek_client.final_discussion
    assert len(agents.deepseek_client.final_discussion) < 1400


class _BudgetRecordingClient:
    def __init__(self, model=None):
        self.model = model
        self.calls = []

    def call_api(self, messages, **kwargs):
        self.calls.append(kwargs.get("max_tokens"))
        return "摘要完成"

    def technical_analysis(self, stock_info, stock_data, indicators):
        return self.call_api([], max_tokens=5000)

    def fundamental_analysis(self, stock_info, financial_data=None, quarterly_data=None):
        return self.call_api([], max_tokens=4200)

    def fund_flow_analysis(self, stock_info, indicators, fund_flow_data=None):
        return self.call_api([], max_tokens=3800)

    def final_decision(self, discussion_result, stock_info, indicators):
        self.call_api([], max_tokens=3600)
        return {"decision_text": "建议继续观察"}


def test_agent_call_api_budgets_are_capped_and_structure_kept(monkeypatch):
    monkeypatch.setattr(ai_agents, "DeepSeekClient", _BudgetRecordingClient)
    agents = ai_agents.StockAnalysisAgents(model="test-model")

    result = agents.run_multi_agent_analysis(
        stock_info={"symbol": "002463", "name": "沪电股份"},
        stock_data=[],
        indicators={"rsi": 71.32},
        financial_data={},
        fund_flow_data={},
        risk_data={},
        enabled_analysts={"technical": True, "fundamental": True, "fund_flow": True, "risk": True, "sentiment": False, "news": False},
    )
    discussion = agents.conduct_team_discussion(
        {
            "technical": {"analysis": "趋势仍在，但建议控制追高"},
            "fundamental": {"analysis": "基本面仍可跟踪"},
            "fund_flow": {"analysis": "资金未明显失控"},
            "risk_management": {"analysis": "仓位不宜过重"},
        },
        {"symbol": "002463", "name": "沪电股份"},
    )
    decision = agents.make_final_decision(discussion, {"symbol": "002463", "name": "沪电股份"}, {"ma20": 83.57})

    assert set(result.keys()) == {"technical", "fundamental", "fund_flow", "risk_management"}
    assert discussion == "摘要完成"
    assert decision["decision_text"] == "建议继续观察"
    capped_tokens = [item for item in agents.deepseek_client.calls if isinstance(item, int)]
    assert capped_tokens
    assert max(capped_tokens) <= ai_agents.config.ANALYSIS_CALL_MAX_TOKENS
    assert ai_agents.config.WORKBENCH_ANALYSIS_TIMEOUT_SECONDS >= 120
