"""Streamlit UI for the unified quant simulation workflow."""

from __future__ import annotations

from datetime import datetime, time, timedelta

import pandas as pd
import streamlit as st

from quant_sim.candidate_pool_service import CandidatePoolService
from quant_sim.engine import QuantSimEngine
from quant_sim.integration import add_stock_to_quant_sim
from quant_sim.portfolio_service import PortfolioService
from quant_sim.replay_service import QuantSimReplayService
from quant_sim.scheduler import get_quant_sim_scheduler
from quant_sim.signal_center_service import SignalCenterService
from streamlit_flash import queue_flash_message, render_flash_messages


QUANT_SIM_FLASH_NAMESPACE = "quant_sim"
ANALYSIS_TIMEFRAME_OPTIONS = ["30m", "1d", "1d+30m"]


def _format_analysis_timeframe(value: str) -> str:
    labels = {
        "30m": "30分钟",
        "1d": "日线",
        "1d+30m": "日线方向 + 30分钟确认",
    }
    return labels.get(str(value), str(value))


def display_quant_sim() -> None:
    """Render the end-to-end quant simulation workspace."""

    candidate_service = CandidatePoolService()
    signal_service = SignalCenterService()
    portfolio_service = PortfolioService()
    engine = QuantSimEngine()
    replay_service = QuantSimReplayService()
    scheduler = get_quant_sim_scheduler()
    account_summary = portfolio_service.get_account_summary()
    scheduler_status = scheduler.get_status()

    st.title("🧪 量化模拟")
    st.caption("选股结果统一进入候选池，系统自动计算 BUY/SELL/HOLD；可手工确认，也可启用自动执行模拟交易。")
    render_flash_messages(QUANT_SIM_FLASH_NAMESPACE)

    metric1, metric2, metric3, metric4, metric5 = st.columns(5)
    metric1.metric("初始资金池", f"{account_summary['initial_cash']:.2f}")
    metric2.metric("可用现金", f"{account_summary['available_cash']:.2f}")
    metric3.metric("持仓市值", f"{account_summary['market_value']:.2f}")
    metric4.metric("总权益", f"{account_summary['total_equity']:.2f}")
    metric5.metric("总盈亏", f"{account_summary['total_pnl']:.2f}")

    st.markdown("### ⏱️ 定时分析")
    status_level, status_message = build_scheduler_status_message(scheduler_status)
    getattr(st, status_level)(status_message)
    status_col1, status_col2, status_col3, status_col4, status_col5 = st.columns(5)
    status_col1.metric("定时状态", "运行中" if scheduler_status["running"] else "已停止")
    status_col2.metric("上次运行", scheduler_status["last_run_at"] or "暂无")
    status_col3.metric("下次运行", scheduler_status["next_run"] or "未启动")
    status_col4.metric("自动执行", "已开启" if scheduler_status["auto_execute"] else "关闭")
    status_col5.metric("分析粒度", _format_analysis_timeframe(str(scheduler_status["analysis_timeframe"])))

    quick_action_col1, quick_action_col2, quick_action_col3, quick_action_col4 = st.columns(4)
    with quick_action_col1:
        if st.button(
            "⚡ 立即分析候选池",
            type="primary",
            use_container_width=True,
            key="quant_sim_scan_now",
        ):
            with st.status("正在分析候选池...", expanded=True) as status:
                status.write("正在扫描候选股与模拟持仓...")
                summary = handle_manual_scan(scheduler)
                status.write(
                    f"已扫描 {summary['candidates_scanned']} 只候选股，检查 {summary['positions_checked']} 个持仓。"
                )
                status.update(label="候选池分析完成", state="complete")
            st.rerun()
    with quick_action_col2:
        if st.button("▶️ 启动定时分析", use_container_width=True, key="quant_sim_start_scheduler_top"):
            handle_scheduler_start(
                scheduler,
                enabled=True,
                auto_execute=bool(scheduler_status["auto_execute"]),
                interval_minutes=int(scheduler_status["interval_minutes"]),
                trading_hours_only=bool(scheduler_status["trading_hours_only"]),
                analysis_timeframe=str(scheduler_status["analysis_timeframe"]),
                market=str(scheduler_status["market"]),
            )
            st.rerun()
    with quick_action_col3:
        if st.button("⏹️ 停止定时分析", use_container_width=True, key="quant_sim_stop_scheduler_top"):
            handle_scheduler_stop(scheduler)
            st.rerun()
    with quick_action_col4:
        if st.button("🔄 刷新页面", use_container_width=True, key="quant_sim_refresh"):
            st.rerun()

    with st.expander("📖 使用流程", expanded=False):
        st.markdown(
            """
            1. 从主力选股、低价擒牛、净利增长、低估值页面把股票加入量化模拟。
            2. 在这里运行“立即分析候选池”，系统会生成 BUY / SELL / HOLD 信号。
            3. 若开启“自动执行模拟交易”，系统会直接写入模拟账户；否则 BUY / SELL 会进入“待执行信号”。
            4. 手工模式下，下单后点“已买入 / 已卖出”，系统更新模拟持仓与后续跟踪。
            """
        )

    with st.expander("⚙️ 定时分析设置与资金池", expanded=False):
        config_col1, config_col2, config_col3, config_col4, config_col5, config_col6 = st.columns(6)
        with config_col1:
            enabled = st.checkbox("启用定时模拟", value=bool(scheduler_status["enabled"]))
        with config_col2:
            interval_minutes = st.number_input(
                "间隔(分钟)",
                min_value=5,
                max_value=240,
                value=int(scheduler_status["interval_minutes"]),
                step=5,
            )
        with config_col3:
            trading_hours_only = st.checkbox(
                "仅交易时段运行",
                value=bool(scheduler_status["trading_hours_only"]),
            )
        with config_col4:
            analysis_timeframe = st.selectbox(
                "分析粒度",
                options=ANALYSIS_TIMEFRAME_OPTIONS,
                index=ANALYSIS_TIMEFRAME_OPTIONS.index(str(scheduler_status["analysis_timeframe"])),
                format_func=_format_analysis_timeframe,
            )
        with config_col5:
            market = st.selectbox(
                "市场",
                options=["CN", "HK", "US"],
                index=["CN", "HK", "US"].index(str(scheduler_status["market"])),
            )
        with config_col6:
            auto_execute = st.checkbox(
                "自动执行模拟交易",
                value=bool(scheduler_status["auto_execute"]),
            )

        fund_col1, fund_col2 = st.columns([1.2, 1.0])
        with fund_col1:
            initial_cash = st.number_input(
                "初始资金池(元)",
                min_value=10000.0,
                value=float(account_summary["initial_cash"]),
                step=10000.0,
                disabled=account_summary["trade_count"] > 0 or account_summary["position_count"] > 0,
            )
        with fund_col2:
            st.caption("初始资金只能在未开始交易前调整。")

        action_col1, action_col2, action_col3, action_col4 = st.columns(4)
        with action_col1:
            if st.button("💾 保存配置", use_container_width=True, key="quant_sim_save_scheduler_config"):
                handle_scheduler_save(
                    scheduler,
                    enabled=enabled,
                    auto_execute=auto_execute,
                    interval_minutes=int(interval_minutes),
                    trading_hours_only=trading_hours_only,
                    analysis_timeframe=analysis_timeframe,
                    market=market,
                )
                st.rerun()
        with action_col2:
            if st.button(
                "▶️ 保存并启动定时分析",
                use_container_width=True,
                key="quant_sim_start_scheduler_config",
            ):
                handle_scheduler_start(
                    scheduler,
                    enabled=enabled,
                    auto_execute=auto_execute,
                    interval_minutes=int(interval_minutes),
                    trading_hours_only=trading_hours_only,
                    analysis_timeframe=analysis_timeframe,
                    market=market,
                )
                st.rerun()
        with action_col3:
            if st.button(
                "⏹️ 停止定时分析",
                use_container_width=True,
                key="quant_sim_stop_scheduler_config",
            ):
                handle_scheduler_stop(scheduler)
                st.rerun()
        with action_col4:
            if st.button("💰 更新资金池", use_container_width=True, key="quant_sim_update_account"):
                handle_account_update(portfolio_service, initial_cash)
                st.rerun()

    with st.expander("🕰️ 历史区间回放", expanded=False):
        replay_mode = st.selectbox(
            "回放模式",
            options=["historical_range", "continuous_to_live"],
            format_func=lambda value: "历史区间回放" if value == "historical_range" else "从过去接续到实时自动模拟",
            key="quant_sim_replay_mode",
        )
        replay_until_now = st.checkbox(
            "结束时间留空则回放到当前时刻",
            value=False,
            key="quant_sim_replay_until_now",
        )

        replay_date_col1, replay_date_col2 = st.columns(2)
        with replay_date_col1:
            replay_start_date = st.date_input(
                "开始日期",
                value=(datetime.now() - timedelta(days=30)).date(),
                key="quant_sim_replay_start_date",
            )
        with replay_date_col2:
            if replay_until_now:
                replay_end_date = None
                st.caption("当前模式下结束日期自动取当前日期时间。")
            else:
                replay_end_date = st.date_input(
                    "结束日期",
                    value=datetime.now().date(),
                    key="quant_sim_replay_end_date",
                )

        replay_time_col1, replay_time_col2, replay_col3 = st.columns(3)
        with replay_time_col1:
            replay_start_time = st.time_input(
                "开始时间",
                value=time(9, 30),
                step=timedelta(minutes=30),
                key="quant_sim_replay_start_time",
            )
        with replay_time_col2:
            if replay_until_now:
                replay_end_time = None
                st.caption("结束时间将自动取当前时刻。")
            else:
                replay_end_time = st.time_input(
                    "结束时间",
                    value=time(15, 0),
                    step=timedelta(minutes=30),
                    key="quant_sim_replay_end_time",
                )
        with replay_col3:
            replay_timeframe = st.selectbox(
                "回放粒度",
                options=["30m", "1d", "1d+30m"],
                format_func=_format_analysis_timeframe,
                key="quant_sim_replay_timeframe",
            )

        overwrite_live = False
        auto_start_scheduler = True
        if replay_mode == "continuous_to_live":
            st.caption("从过去接续到实时自动模拟：先完成历史回放，再把最终模拟账户状态接入当前实时量化模拟。")
            replay_flag_col1, replay_flag_col2 = st.columns(2)
            with replay_flag_col1:
                overwrite_live = st.checkbox(
                    "覆盖当前实时模拟账户",
                    value=False,
                    key="quant_sim_replay_overwrite_live",
                )
            with replay_flag_col2:
                auto_start_scheduler = st.checkbox(
                    "回放完成后自动启动定时分析",
                    value=True,
                    key="quant_sim_replay_auto_start_scheduler",
                )

        replay_button_label = "▶️ 开始区间模拟" if replay_mode == "historical_range" else "▶️ 从过去接续到实时自动模拟"
        if st.button(replay_button_label, type="primary", use_container_width=True, key="quant_sim_run_replay"):
            start_datetime = build_replay_datetime(replay_start_date, replay_start_time)
            end_datetime = None
            if not replay_until_now and replay_end_date is not None and replay_end_time is not None:
                end_datetime = build_replay_datetime(replay_end_date, replay_end_time)
            with st.status("正在执行历史区间回放...", expanded=True) as status:
                status.write("正在加载候选池与历史行情数据...")
                if replay_mode == "historical_range":
                    summary = handle_historical_replay(
                        replay_service,
                        start_datetime=start_datetime,
                        end_datetime=end_datetime,
                        timeframe=replay_timeframe,
                        market=str(scheduler_status["market"]),
                    )
                else:
                    summary = handle_continuous_replay(
                        replay_service,
                        start_datetime=start_datetime,
                        end_datetime=end_datetime,
                        timeframe=replay_timeframe,
                        market=str(scheduler_status["market"]),
                        overwrite_live=overwrite_live,
                        auto_start_scheduler=auto_start_scheduler,
                    )
                status.write(
                    f"已完成 {summary['checkpoint_count']} 个检查点，生成 {summary['trade_count']} 笔模拟交易。"
                )
                status.update(label="历史区间模拟完成", state="complete")
            st.rerun()

    with st.form("quant_sim_add_manual_candidate"):
        col1, col2, col3, col4 = st.columns([1.1, 1.4, 1.1, 1.0])
        with col1:
            stock_code = st.text_input("股票代码", placeholder="如 600000")
        with col2:
            stock_name = st.text_input("股票名称", placeholder="如 浦发银行")
        with col3:
            source = st.selectbox(
                "来源策略",
                options=["manual", "main_force", "low_price_bull", "profit_growth", "value_stock", "small_cap"],
                format_func=_format_source,
            )
        with col4:
            latest_price = st.number_input("参考价格", min_value=0.0, value=0.0, step=0.01)

        notes = st.text_input("备注", placeholder="可选")
        submitted = st.form_submit_button("➕ 手动加入候选池", use_container_width=True)
        if submitted:
            success, message, _ = add_stock_to_quant_sim(
                stock_code=stock_code,
                stock_name=stock_name,
                source=source,
                latest_price=latest_price or None,
                notes=notes or None,
            )
            if success:
                queue_quant_sim_flash("success", message)
                st.rerun()
            queue_quant_sim_flash("error", message)

    tab_candidates, tab_signals, tab_pending, tab_positions, tab_trades, tab_equity, tab_replay = st.tabs(
        ["📥 候选池", "🧠 策略信号", "⏳ 待执行", "💼 模拟持仓", "📒 成交记录", "📈 权益快照", "🕰️ 回放结果"]
    )

    with tab_candidates:
        candidates = candidate_service.list_candidates(status="active")
        if not candidates:
            st.info("候选池为空，可以从选股页加入标的，或在上方手动添加。")
        else:
            st.dataframe(candidates, use_container_width=True, hide_index=True)
            st.markdown("---")
            for candidate in candidates:
                with st.expander(f"{candidate['stock_code']} - {candidate.get('stock_name') or '未命名'}"):
                    sources = candidate.get("sources") or [candidate.get("source", "manual")]
                    st.write(f"来源策略：{' / '.join(_format_source(source) for source in sources)}")
                    st.write(f"参考价格：{candidate.get('latest_price', 0) or 0:.2f}")
                    if st.button("立即分析该标的", key=f"analyze_candidate_{candidate['id']}"):
                        signal = engine.analyze_candidate(
                            candidate,
                            analysis_timeframe=str(scheduler_status["analysis_timeframe"]),
                        )
                        queue_quant_sim_flash(
                            "success",
                            f"✅ 已生成信号：{signal['action']} / 置信度 {signal['confidence']}%",
                        )
                        st.rerun()

    with tab_signals:
        signals = signal_service.list_signals(limit=50)
        if not signals:
            st.info("暂无信号记录。")
        else:
            for signal in signals:
                expander_label = (
                    f"{format_signal_expander_label(signal)} | {signal['status']}"
                )
                with st.expander(expander_label):
                    st.markdown(render_action_badge_html(signal.get("action", "HOLD")), unsafe_allow_html=True)
                    st.markdown(f"**置信度**：{signal.get('confidence', 0)}%")
                    st.markdown(f"**建议仓位**：{signal.get('position_size_pct', 0)}%")
                    strategy_summary = render_strategy_profile_summary(signal.get("strategy_profile"))
                    if strategy_summary:
                        st.markdown(strategy_summary)
                    st.markdown(f"**推理**：{signal.get('reasoning') or '暂无'}")
                    st.caption(
                        f"创建时间：{signal.get('created_at')} | 执行状态：{signal.get('status')}"
                    )

    with tab_pending:
        pending_signals = signal_service.list_pending_signals()
        if not pending_signals:
            st.info("当前没有待执行信号。")
        else:
            for signal in pending_signals:
                with st.expander(
                    format_signal_expander_label(signal),
                    expanded=True,
                ):
                    st.markdown(render_action_badge_html(signal.get("action", "HOLD")), unsafe_allow_html=True)
                    strategy_summary = render_strategy_profile_summary(signal.get("strategy_profile"))
                    if strategy_summary:
                        st.markdown(strategy_summary)
                    st.markdown(f"**推理**：{signal.get('reasoning') or '暂无'}")
                    st.markdown(f"**建议仓位**：{signal.get('position_size_pct', 0)}%")

                    default_price = resolve_pending_signal_default_price(
                        signal,
                        candidate_service=candidate_service,
                        portfolio_service=portfolio_service,
                    )

                    price = st.number_input(
                        "成交价",
                        min_value=0.01,
                        value=float(default_price),
                        step=0.01,
                        key=f"pending_price_{signal['id']}",
                    )
                    quantity = st.number_input(
                        "成交数量",
                        min_value=0,
                        value=100,
                        step=100,
                        key=f"pending_quantity_{signal['id']}",
                    )
                    note = st.text_input(
                        "执行备注",
                        value="",
                        placeholder="如：已在券商端下单",
                        key=f"pending_note_{signal['id']}",
                    )

                    col1, col2, col3 = st.columns(3)
                    if signal["action"] == "BUY":
                        with col1:
                            buy_key = f"confirm_buy_{signal['id']}"
                            if render_colored_action_button("✅ 标记已买入", key=buy_key, tone="buy"):
                                handle_confirm_buy(
                                    portfolio_service,
                                    signal_id=signal["id"],
                                    price=price,
                                    quantity=int(quantity),
                                    note=note or "已手工买入",
                                )
                                st.rerun()
                    else:
                        with col1:
                            sell_key = f"confirm_sell_{signal['id']}"
                            if render_colored_action_button("✅ 标记已卖出", key=sell_key, tone="sell"):
                                handle_confirm_sell(
                                    portfolio_service,
                                    signal_id=signal["id"],
                                    price=price,
                                    quantity=int(quantity),
                                    note=note or "已手工卖出",
                                )
                                st.rerun()

                    with col2:
                        if st.button("⏰ 延后处理", key=f"delay_signal_{signal['id']}"):
                            portfolio_service.delay_signal(signal["id"], note=note or "延后处理")
                            queue_quant_sim_flash("info", "已延后，信号会继续保留在待执行列表。")
                            st.rerun()

                    with col3:
                        if st.button("🚫 忽略信号", key=f"ignore_signal_{signal['id']}"):
                            portfolio_service.ignore_signal(signal["id"], note=note or "人工忽略")
                            queue_quant_sim_flash("warning", "已忽略该信号。")
                            st.rerun()

    with tab_positions:
        positions = portfolio_service.list_positions()
        if not positions:
            st.info("当前暂无模拟持仓。")
        else:
            st.dataframe(positions, use_container_width=True, hide_index=True)

    with tab_trades:
        trades = portfolio_service.get_trade_history(limit=100)
        if not trades:
            st.info("当前还没有成交记录。")
        else:
            st.dataframe(trades, use_container_width=True, hide_index=True)

    with tab_equity:
        snapshots = portfolio_service.get_account_snapshots(limit=100)
        if not snapshots:
            st.info("当前还没有权益快照，先运行一次分析或确认一次交易。")
        else:
            snapshot_df = pd.DataFrame(list(reversed(snapshots)))
            snapshot_df["created_at"] = pd.to_datetime(snapshot_df["created_at"])
            chart_df = snapshot_df.set_index("created_at")[["total_equity", "available_cash", "market_value"]]
            st.line_chart(chart_df, use_container_width=True)
            st.dataframe(snapshot_df, use_container_width=True, hide_index=True)

    with tab_replay:
        replay_runs = candidate_service.db.get_sim_runs(limit=20)
        if not replay_runs:
            st.info("还没有历史区间模拟结果。先在上方运行一次历史区间回放。")
        else:
            run_df = pd.DataFrame(replay_runs)
            if "metadata_json" in run_df.columns:
                run_df = run_df.drop(columns=["metadata_json"])
            st.dataframe(run_df, use_container_width=True, hide_index=True)

            latest_run = replay_runs[0]
            replay_metric1, replay_metric2, replay_metric3, replay_metric4 = st.columns(4)
            replay_metric1.metric("最近收益率", f"{float(latest_run.get('total_return_pct') or 0):.2f}%")
            replay_metric2.metric("最大回撤", f"{float(latest_run.get('max_drawdown_pct') or 0):.2f}%")
            replay_metric3.metric("胜率", f"{float(latest_run.get('win_rate') or 0):.2f}%")
            replay_metric4.metric("交易笔数", str(int(latest_run.get("trade_count") or 0)))

            replay_snapshots = candidate_service.db.get_sim_run_snapshots(int(latest_run["id"]))
            if replay_snapshots:
                replay_snapshot_df = pd.DataFrame(replay_snapshots)
                replay_snapshot_df["created_at"] = pd.to_datetime(replay_snapshot_df["created_at"])
                replay_chart_df = replay_snapshot_df.set_index("created_at")[["total_equity", "available_cash", "market_value"]]
                st.line_chart(replay_chart_df, use_container_width=True)
                st.dataframe(replay_snapshot_df, use_container_width=True, hide_index=True)

            replay_trades = candidate_service.db.get_sim_run_trades(int(latest_run["id"]))
            if replay_trades:
                st.markdown("#### 最近一次区间模拟成交")
                st.dataframe(replay_trades, use_container_width=True, hide_index=True)


def _format_source(source: str) -> str:
    return {
        "manual": "手工加入",
        "main_force": "主力选股",
        "low_price_bull": "低价擒牛",
        "profit_growth": "净利增长",
        "value_stock": "低估值策略",
        "small_cap": "小市值策略",
    }.get(source, source)


def render_action_badge_html(action: str) -> str:
    normalized = str(action or "HOLD").upper()
    palette = {
        "BUY": {"bg": "#fde8e8", "fg": "#d94b4b", "border": "#f3b3b3"},
        "SELL": {"bg": "#e8f7ee", "fg": "#1a9b5b", "border": "#9fd7b5"},
        "HOLD": {"bg": "#f3f4f6", "fg": "#6b7280", "border": "#d1d5db"},
    }.get(normalized, {"bg": "#f3f4f6", "fg": "#6b7280", "border": "#d1d5db"})
    return (
        "<div style='margin:0 0 0.5rem 0;'>"
        f"<span style='display:inline-block;padding:0.25rem 0.65rem;border-radius:999px;"
        f"font-weight:700;font-size:0.92rem;background:{palette['bg']};color:{palette['fg']};"
        f"border:1px solid {palette['border']};'>{normalized}</span>"
        "</div>"
    )


def format_signal_expander_label(signal: dict) -> str:
    action = str(signal.get("action") or "HOLD").upper()
    marker = {"BUY": "🔴", "SELL": "🟢", "HOLD": "⚪"}.get(action, "⚪")
    stock_code = str(signal.get("stock_code") or "").strip()
    stock_name = str(signal.get("stock_name") or "").strip()
    if stock_name:
        return f"{marker} {action} | {stock_code} - {stock_name}"
    return f"{marker} {action} | {stock_code}"


def render_strategy_profile_summary(strategy_profile: dict | None) -> str:
    if not strategy_profile:
        return ""

    market_regime = strategy_profile.get("market_regime") or {}
    fundamental_quality = strategy_profile.get("fundamental_quality") or {}
    risk_style = strategy_profile.get("risk_style") or {}
    analysis_timeframe = strategy_profile.get("analysis_timeframe") or {}
    effective_thresholds = strategy_profile.get("effective_thresholds") or {}

    lines = [
        "**策略概览**",
        f"- 市场状态：{market_regime.get('label', '未知')}",
        f"- 基本面质量：{fundamental_quality.get('label', '未知')}",
        f"- 当前风格：{risk_style.get('label', '未知')}",
        f"- 时间框架：{analysis_timeframe.get('key', '未知')}",
    ]

    max_position_ratio = effective_thresholds.get("max_position_ratio")
    if max_position_ratio is not None:
        lines.append(f"- 建议仓位：{float(max_position_ratio) * 100:.1f}%")

    buy_threshold = effective_thresholds.get("buy_threshold")
    sell_threshold = effective_thresholds.get("sell_threshold")
    if buy_threshold is not None and sell_threshold is not None:
        lines.append(
            f"- 阈值：买入 {float(buy_threshold):.2f} / 卖出 {float(sell_threshold):.2f}"
        )

    confirmation = effective_thresholds.get("confirmation")
    if confirmation:
        lines.append(f"- 确认机制：{confirmation}")

    return "\n".join(lines)


def build_action_button_style_css(key: str, tone: str) -> str:
    marker_id = f"{key}_marker"
    palette = {
        "buy": {
            "bg": "#d94b4b",
            "bg_soft": "#fde8e8",
            "hover": "#c53d3d",
            "shadow": "rgba(217, 75, 75, 0.28)",
        },
        "sell": {
            "bg": "#1a9b5b",
            "bg_soft": "#e8f7ee",
            "hover": "#13804a",
            "shadow": "rgba(26, 155, 91, 0.24)",
        },
    }[tone]
    return f"""
<div id="{marker_id}"></div>
<style>
div.element-container:has(#{marker_id}) + div.element-container button {{
    background: linear-gradient(135deg, {palette['bg_soft']} 0%, {palette['bg']} 100%) !important;
    color: #ffffff !important;
    border: 1px solid {palette['bg']} !important;
    box-shadow: 0 4px 15px {palette['shadow']} !important;
}}
div.element-container:has(#{marker_id}) + div.element-container button:hover {{
    background: linear-gradient(135deg, {palette['bg']} 0%, {palette['hover']} 100%) !important;
    color: #ffffff !important;
    box-shadow: 0 6px 20px {palette['shadow']} !important;
}}
</style>
"""


def render_colored_action_button(label: str, *, key: str, tone: str, use_container_width: bool = False) -> bool:
    st.markdown(build_action_button_style_css(key, tone), unsafe_allow_html=True)
    return st.button(label, key=key, use_container_width=use_container_width)


def queue_quant_sim_flash(level: str, message: str, state=None) -> None:
    flash_state = st.session_state if state is None else state
    queue_flash_message(flash_state, QUANT_SIM_FLASH_NAMESPACE, level, message)


def build_replay_datetime(selected_date, selected_time) -> datetime:
    return datetime.combine(selected_date, selected_time).replace(microsecond=0)


def build_scheduler_status_message(status: dict) -> tuple[str, str]:
    auto_execute_label = "自动执行已开启" if status.get("auto_execute") else "自动执行已关闭"
    timeframe_label = _format_analysis_timeframe(str(status.get("analysis_timeframe") or "30m"))
    if status.get("running"):
        return (
            "success",
            f"🟢 定时分析运行中，当前按每 {status.get('interval_minutes', 0)} 分钟执行一次。"
            f" 当前策略粒度：{timeframe_label}。{auto_execute_label}。下次运行：{status.get('next_run') or '计算中'}。",
        )
    if status.get("enabled"):
        return (
            "warning",
            f"🟡 已配置定时分析，但当前还未启动。计划间隔 {status.get('interval_minutes', 0)} 分钟，"
            f"当前策略粒度：{timeframe_label}，{auto_execute_label}，请点击“启动定时分析”。",
        )
    return (
        "info",
        f"⚪ 当前未启用定时分析，只会在你手动点击“立即分析候选池”时运行。当前策略粒度：{timeframe_label}。{auto_execute_label}。",
    )


def handle_manual_scan(scheduler, state=None) -> dict:
    summary = scheduler.run_once(run_reason="manual_scan")
    queue_quant_sim_flash(
        "success",
        f"✅ 已扫描 {summary['candidates_scanned']} 只候选股，生成 {summary['signals_created']} 条信号，"
        f"自动执行 {summary.get('auto_executed', 0)} 条，总权益 {summary['total_equity']:.2f}",
        state=state,
    )
    return summary


def handle_scheduler_save(
    scheduler,
    *,
    enabled: bool,
    auto_execute: bool = False,
    interval_minutes: int,
    trading_hours_only: bool,
    analysis_timeframe: str,
    market: str,
    state=None,
) -> None:
    scheduler.update_config(
        enabled=enabled,
        auto_execute=auto_execute,
        interval_minutes=interval_minutes,
        trading_hours_only=trading_hours_only,
        analysis_timeframe=analysis_timeframe,
        market=market,
    )
    queue_quant_sim_flash("success", "✅ 定时分析配置已保存", state=state)


def handle_scheduler_start(
    scheduler,
    *,
    enabled: bool,
    auto_execute: bool = False,
    interval_minutes: int,
    trading_hours_only: bool,
    analysis_timeframe: str,
    market: str,
    state=None,
) -> bool:
    scheduler.update_config(
        enabled=enabled,
        auto_execute=auto_execute,
        interval_minutes=interval_minutes,
        trading_hours_only=trading_hours_only,
        analysis_timeframe=analysis_timeframe,
        market=market,
    )
    started = scheduler.start()
    if started:
        queue_quant_sim_flash("success", "✅ 定时分析已启动", state=state)
    else:
        queue_quant_sim_flash("warning", "定时分析未启动，请先启用并保存配置", state=state)
    return started


def handle_scheduler_stop(scheduler, state=None) -> bool:
    stopped = scheduler.stop()
    if stopped:
        queue_quant_sim_flash("info", "⏹️ 定时分析已停止", state=state)
    else:
        queue_quant_sim_flash("warning", "定时分析当前未运行", state=state)
    return stopped


def handle_account_update(portfolio_service, initial_cash: float, state=None) -> bool:
    try:
        portfolio_service.configure_account(initial_cash)
    except ValueError as exc:
        queue_quant_sim_flash("error", f"更新失败：{exc}", state=state)
        return False
    queue_quant_sim_flash("success", "✅ 资金池已更新", state=state)
    return True


def handle_historical_replay(
    replay_service,
    *,
    start_datetime,
    end_datetime=None,
    timeframe: str,
    market: str,
    state=None,
) -> dict:
    summary = replay_service.run_historical_range(
        start_datetime=start_datetime,
        end_datetime=end_datetime,
        timeframe=timeframe,
        market=market,
    )
    queue_quant_sim_flash(
        "success",
        f"✅ 历史区间模拟完成：{summary['checkpoint_count']} 个检查点，"
        f"{summary['trade_count']} 笔交易，收益率 {summary['total_return_pct']:.2f}%",
        state=state,
    )
    return summary


def handle_continuous_replay(
    replay_service,
    *,
    start_datetime,
    end_datetime=None,
    timeframe: str,
    market: str,
    overwrite_live: bool,
    auto_start_scheduler: bool,
    state=None,
) -> dict:
    summary = replay_service.run_past_to_live(
        start_datetime=start_datetime,
        end_datetime=end_datetime,
        timeframe=timeframe,
        market=market,
        overwrite_live=overwrite_live,
        auto_start_scheduler=auto_start_scheduler,
    )
    queue_quant_sim_flash(
        "success",
        f"✅ 连续模拟完成：{summary['checkpoint_count']} 个检查点，"
        f"{summary['trade_count']} 笔交易，收益率 {summary['total_return_pct']:.2f}%，已接入实时模拟账户。",
        state=state,
    )
    return summary


def resolve_pending_signal_default_price(signal: dict, candidate_service, portfolio_service) -> float:
    stock_code = signal.get("stock_code")
    if stock_code and candidate_service is not None:
        candidate = candidate_service.db.get_candidate(stock_code)
        if candidate:
            try:
                latest_price = float(candidate.get("latest_price") or 0)
                if latest_price > 0:
                    return latest_price
            except (TypeError, ValueError):
                pass

    if stock_code and portfolio_service is not None:
        for position in portfolio_service.list_positions():
            if position.get("stock_code") == stock_code:
                try:
                    latest_price = float(position.get("latest_price") or position.get("avg_price") or 0)
                    if latest_price > 0:
                        return latest_price
                except (TypeError, ValueError):
                    break

    return 0.01


def handle_confirm_buy(portfolio_service, *, signal_id: int, price: float, quantity: int, note: str, state=None) -> bool:
    try:
        portfolio_service.confirm_buy(
            signal_id,
            price=price,
            quantity=quantity,
            note=note,
        )
    except ValueError as exc:
        queue_quant_sim_flash("error", f"执行失败：{exc}", state=state)
        return False
    queue_quant_sim_flash("success", "✅ 已更新模拟持仓", state=state)
    return True


def handle_confirm_sell(portfolio_service, *, signal_id: int, price: float, quantity: int, note: str, state=None) -> bool:
    try:
        portfolio_service.confirm_sell(
            signal_id,
            price=price,
            quantity=quantity,
            note=note,
        )
    except ValueError as exc:
        queue_quant_sim_flash("error", f"执行失败：{exc}", state=state)
        return False
    queue_quant_sim_flash("success", "✅ 已更新模拟持仓", state=state)
    return True
