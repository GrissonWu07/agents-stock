from datetime import date
from pathlib import Path

from streamlit_flash import consume_flash_messages
from quant_sim import ui


class DummyScheduler:
    def __init__(self):
        self.config_updates = []
        self.started = False
        self.stopped = False
        self.last_run_reason = None

    def run_once(self, run_reason="scheduled_scan"):
        self.last_run_reason = run_reason
        return {
            "candidates_scanned": 3,
            "signals_created": 2,
            "positions_checked": 1,
            "auto_executed": 1,
            "total_equity": 100321.5,
        }

    def update_config(self, **kwargs):
        self.config_updates.append(kwargs)

    def start(self):
        self.started = True
        return True

    def stop(self):
        self.stopped = True
        return True


class DummyPortfolioService:
    def __init__(self):
        self.updated_cash = None
        self.confirmed_buy = None

    def configure_account(self, initial_cash):
        self.updated_cash = initial_cash

    def confirm_buy(self, signal_id, price, quantity, note):
        self.confirmed_buy = {
            "signal_id": signal_id,
            "price": price,
            "quantity": quantity,
            "note": note,
        }


def test_handle_manual_scan_queues_success_flash_message():
    state = {}
    scheduler = DummyScheduler()

    summary = ui.handle_manual_scan(scheduler, state=state)
    flashes = consume_flash_messages(state, ui.QUANT_SIM_FLASH_NAMESPACE)

    assert scheduler.last_run_reason == "manual_scan"
    assert summary["signals_created"] == 2
    assert flashes == [
        {
            "level": "success",
            "message": "✅ 已扫描 3 只候选股，生成 2 条信号，自动执行 1 条，总权益 100321.50",
        }
    ]


def test_handle_scheduler_start_queues_feedback_and_updates_config():
    state = {}
    scheduler = DummyScheduler()

    started = ui.handle_scheduler_start(
        scheduler,
        enabled=True,
        auto_execute=True,
        interval_minutes=15,
        trading_hours_only=True,
        analysis_timeframe="30m",
        start_date="2026-04-10",
        market="CN",
        state=state,
    )
    flashes = consume_flash_messages(state, ui.QUANT_SIM_FLASH_NAMESPACE)

    assert started is True
    assert scheduler.started is True
    assert scheduler.config_updates == [
        {
            "enabled": True,
            "auto_execute": True,
            "interval_minutes": 15,
            "trading_hours_only": True,
            "analysis_timeframe": "30m",
            "start_date": "2026-04-10",
            "market": "CN",
        }
    ]
    assert flashes == [{"level": "success", "message": "✅ 定时分析已启动"}]


def test_handle_account_update_queues_success_flash_message():
    state = {}
    portfolio_service = DummyPortfolioService()

    ui.handle_account_update(portfolio_service, 200000.0, state=state)
    flashes = consume_flash_messages(state, ui.QUANT_SIM_FLASH_NAMESPACE)

    assert portfolio_service.updated_cash == 200000.0
    assert flashes == [{"level": "success", "message": "✅ 资金池已更新"}]


def test_quant_sim_ui_exposes_single_scheduler_control_area():
    ui_source = Path("C:/Projects/githubs/aiagents-stock/quant_sim/ui.py").read_text(encoding="utf-8")

    assert 'key="quant_sim_start_scheduler_top"' not in ui_source
    assert 'key="quant_sim_scan_now"' not in ui_source
    assert 'key="quant_sim_manual_scan_config"' in ui_source
    assert "⏹️ 停止定时分析" in ui_source


def test_quant_sim_scheduler_buttons_use_explicit_keys():
    ui_source = Path("C:/Projects/githubs/aiagents-stock/quant_sim/ui.py").read_text(encoding="utf-8")

    assert 'key="quant_sim_stop_scheduler_config"' in ui_source
    assert 'key="quant_sim_manual_scan_config"' in ui_source
    assert 'key="quant_sim_scheduler_start_date"' in ui_source


def test_quant_sim_replay_ui_exposes_background_status_and_cancel_controls():
    ui_source = Path("C:/Projects/githubs/aiagents-stock/quant_sim/ui.py").read_text(encoding="utf-8")

    assert "当前回放状态" in ui_source
    assert "取消回放任务" in ui_source
    assert "最近事件" in ui_source


def test_quant_sim_replay_results_expose_latest_status_and_events():
    ui_source = Path("C:/Projects/githubs/aiagents-stock/quant_sim/ui.py").read_text(encoding="utf-8")

    assert "最近一次回放状态" in ui_source
    assert "最近一次回放事件" in ui_source


def test_build_scheduler_status_message_distinguishes_running_and_idle_states():
    running_level, running_message = ui.build_scheduler_status_message(
        {
            "running": True,
            "enabled": True,
            "auto_execute": True,
            "interval_minutes": 15,
            "analysis_timeframe": "30m",
            "start_date": "2026-04-10",
            "last_run_at": "2026-04-09 15:00:00",
            "next_run": "2026-04-09 15:15:00",
        }
    )
    configured_level, configured_message = ui.build_scheduler_status_message(
        {
            "running": False,
            "enabled": True,
            "auto_execute": False,
            "interval_minutes": 15,
            "analysis_timeframe": "30m",
            "start_date": "2026-04-10",
            "last_run_at": None,
            "next_run": None,
        }
    )
    disabled_level, disabled_message = ui.build_scheduler_status_message(
        {
            "running": False,
            "enabled": False,
            "auto_execute": False,
            "interval_minutes": 15,
            "analysis_timeframe": "30m",
            "start_date": "2026-04-10",
            "last_run_at": None,
            "next_run": None,
        }
    )

    assert running_level == "success"
    assert "运行中" in running_message
    assert "15 分钟" in running_message
    assert "自动执行已开启" in running_message
    assert configured_level == "warning"
    assert "已配置" in configured_message
    assert "未启动" in configured_message
    assert "自动执行已关闭" in configured_message
    assert disabled_level == "info"
    assert "未启用" in disabled_message
    assert "2026-04-10" in running_message


def test_handle_scheduler_save_queues_feedback_and_updates_start_date():
    state = {}
    scheduler = DummyScheduler()

    ui.handle_scheduler_save(
        scheduler,
        enabled=True,
        auto_execute=False,
        interval_minutes=20,
        trading_hours_only=False,
        analysis_timeframe="1d+30m",
        start_date="2026-04-12",
        market="CN",
        state=state,
    )
    flashes = consume_flash_messages(state, ui.QUANT_SIM_FLASH_NAMESPACE)

    assert scheduler.config_updates == [
        {
            "enabled": True,
            "auto_execute": False,
            "interval_minutes": 20,
            "trading_hours_only": False,
            "analysis_timeframe": "1d+30m",
            "start_date": "2026-04-12",
            "market": "CN",
        }
    ]
    assert flashes == [{"level": "success", "message": "✅ 定时分析配置已保存"}]


def test_resolve_pending_signal_default_price_prefers_candidate_latest_price():
    candidate_service = type(
        "DummyCandidateService",
        (),
        {
            "db": type(
                "DummyCandidateDB",
                (),
                {"get_candidate": staticmethod(lambda stock_code: {"latest_price": 61.99})},
            )()
        },
    )()

    default_price = ui.resolve_pending_signal_default_price(
        {"stock_code": "300390"},
        candidate_service=candidate_service,
        portfolio_service=None,
    )

    assert default_price == 61.99


def test_handle_confirm_buy_queues_success_flash_message():
    state = {}
    portfolio_service = DummyPortfolioService()

    success = ui.handle_confirm_buy(
        portfolio_service,
        signal_id=12,
        price=61.99,
        quantity=100,
        note="已手工买入",
        state=state,
    )
    flashes = consume_flash_messages(state, ui.QUANT_SIM_FLASH_NAMESPACE)

    assert success is True
    assert portfolio_service.confirmed_buy == {
        "signal_id": 12,
        "price": 61.99,
        "quantity": 100,
        "note": "已手工买入",
    }
    assert flashes == [{"level": "success", "message": "✅ 已更新模拟持仓"}]


def test_render_action_badge_html_uses_buy_red_sell_green_hold_gray():
    buy_badge = ui.render_action_badge_html("BUY")
    sell_badge = ui.render_action_badge_html("SELL")
    hold_badge = ui.render_action_badge_html("HOLD")

    assert "#d94b4b" in buy_badge
    assert "BUY" in buy_badge
    assert "#1a9b5b" in sell_badge
    assert "SELL" in sell_badge
    assert "#6b7280" in hold_badge
    assert "HOLD" in hold_badge


def test_format_signal_expander_label_includes_visual_action_marker():
    assert ui.format_signal_expander_label({"action": "BUY", "stock_code": "300390", "stock_name": "天华新能"}) == "🔴 BUY | 300390 - 天华新能"
    assert ui.format_signal_expander_label({"action": "SELL", "stock_code": "301291", "stock_name": "明阳电气"}) == "🟢 SELL | 301291 - 明阳电气"


def test_build_action_button_style_css_uses_red_for_buy_and_green_for_sell():
    buy_css = ui.build_action_button_style_css("confirm_buy_12", "buy")
    sell_css = ui.build_action_button_style_css("confirm_sell_34", "sell")

    assert "#d94b4b" in buy_css
    assert "#fde8e8" in buy_css
    assert "#1a9b5b" in sell_css
    assert "#e8f7ee" in sell_css
    assert "confirm_buy_12_marker" in buy_css
    assert "confirm_sell_34_marker" in sell_css


def test_quant_sim_ui_exposes_auto_execution_controls_and_status_copy():
    ui_source = Path("C:/Projects/githubs/aiagents-stock/quant_sim/ui.py").read_text(encoding="utf-8")

    assert "自动执行模拟交易" in ui_source
    assert "自动执行" in ui_source


def test_render_strategy_profile_summary_shows_strategy_basics():
    summary = ui.render_strategy_profile_summary(
        {
            "market_regime": {"label": "牛市", "score": 0.66},
            "fundamental_quality": {"label": "强基本面", "score": 0.58},
            "risk_style": {"label": "激进", "max_position_ratio": 0.8},
            "analysis_timeframe": {"key": "30m"},
            "effective_thresholds": {
                "buy_threshold": 0.64,
                "sell_threshold": -0.25,
                "max_position_ratio": 0.5,
            },
        }
    )

    assert "市场状态" in summary
    assert "基本面质量" in summary
    assert "当前风格" in summary
    assert "时间框架" in summary
    assert "建议仓位" in summary
