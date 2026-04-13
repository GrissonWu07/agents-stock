#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared inline batch deep analysis for strategy selector pages."""

from __future__ import annotations

import concurrent.futures
import time
from typing import Any, Callable

import pandas as pd
import streamlit as st

import app.config as config


BatchAnalyzerFn = Callable[..., dict[str, Any]]


def normalize_stock_code(stock_code: Any) -> str:
    """Normalize selector output like 600000.SH -> 600000."""
    if stock_code is None:
        return ""

    normalized = str(stock_code).strip().upper()
    if not normalized:
        return ""

    for delimiter in (".", " "):
        if delimiter in normalized:
            normalized = normalized.split(delimiter)[0]
    return normalized


def extract_batch_candidates(stocks_df: pd.DataFrame, limit: int) -> list[dict[str, str]]:
    """Extract normalized symbol/name pairs from a selector dataframe."""
    candidates: list[dict[str, str]] = []
    if stocks_df is None or stocks_df.empty or limit <= 0:
        return candidates

    for _, row in stocks_df.head(limit).iterrows():
        symbol = normalize_stock_code(row.get("股票代码"))
        name = str(row.get("股票简称", "") or "").strip()
        if not symbol or not name:
            continue
        candidates.append({"symbol": symbol, "name": name})
    return candidates


def sort_main_force_batch_candidates(stocks_df: pd.DataFrame) -> pd.DataFrame:
    """Sort main force candidates by the main fund flow column descending."""
    if stocks_df is None or stocks_df.empty:
        return stocks_df

    sorted_df = stocks_df.copy()
    main_fund_patterns = [
        "区间主力资金流向",
        "区间主力资金净流入",
        "主力资金流向",
        "主力资金净流入",
        "主力净流入",
    ]
    main_fund_col = None
    for pattern in main_fund_patterns:
        matching = [col for col in sorted_df.columns if pattern in col]
        if matching:
            main_fund_col = matching[0]
            break

    if not main_fund_col:
        return sorted_df

    sorted_df[main_fund_col] = pd.to_numeric(sorted_df[main_fund_col], errors="coerce")
    return sorted_df.sort_values(by=main_fund_col, ascending=False, na_position="last")


def run_batch_deep_analysis(
    candidates: list[dict[str, str]],
    analysis_mode: str,
    max_workers: int,
    analyzer_fn: BatchAnalyzerFn,
    selected_model: str | None = None,
    enabled_analysts_config: dict[str, bool] | None = None,
) -> dict[str, Any]:
    """Run reusable batch analysis for selector-generated candidates."""
    started_at = time.time()
    indexed_results: list[tuple[int, dict[str, Any]]] = []
    selected_model = selected_model or config.DEFAULT_MODEL_NAME
    enabled_analysts_config = enabled_analysts_config or {
        "technical": True,
        "fundamental": True,
        "fund_flow": True,
        "risk": True,
        "sentiment": False,
        "news": False,
    }

    if analysis_mode == "parallel":
        worker_count = max(1, min(max_workers, len(candidates) or 1))
        with concurrent.futures.ThreadPoolExecutor(max_workers=worker_count) as executor:
            futures = {
                executor.submit(
                    analyzer_fn,
                    candidate["symbol"],
                    "1y",
                    enabled_analysts_config,
                    selected_model,
                ): (index, candidate)
                for index, candidate in enumerate(candidates)
            }
            for future in concurrent.futures.as_completed(futures):
                index, candidate = futures[future]
                try:
                    indexed_results.append((index, future.result()))
                except Exception as exc:
                    indexed_results.append(
                        (
                            index,
                            {
                                "symbol": candidate["symbol"],
                                "error": str(exc),
                                "success": False,
                            },
                        )
                    )
    else:
        for index, candidate in enumerate(candidates):
            try:
                indexed_results.append(
                    (
                        index,
                        analyzer_fn(
                            candidate["symbol"],
                            "1y",
                            enabled_analysts_config,
                            selected_model,
                        ),
                    )
                )
            except Exception as exc:
                indexed_results.append(
                    (
                        index,
                        {
                            "symbol": candidate["symbol"],
                            "error": str(exc),
                            "success": False,
                        },
                    )
                )

    indexed_results.sort(key=lambda item: item[0])
    results = [payload for _, payload in indexed_results]
    elapsed_time = time.time() - started_at
    success_count = sum(1 for result in results if result.get("success", False))
    failed_count = len(results) - success_count
    return {
        "results": results,
        "total": len(results),
        "success": success_count,
        "failed": failed_count,
        "elapsed_time": elapsed_time,
        "analysis_mode": analysis_mode,
    }


def display_batch_deep_analysis_section(
    stocks_df: pd.DataFrame,
    strategy_key: str,
    strategy_label: str,
    default_count: int | None = None,
    sorted_df: pd.DataFrame | None = None,
) -> None:
    """Render inline batch deep analysis controls and results in a strategy page."""
    session_key = f"{strategy_key}_batch_results"
    batch_results = st.session_state.get(session_key)

    if (stocks_df is None or stocks_df.empty) and not batch_results:
        return

    source_df = sorted_df if sorted_df is not None else stocks_df
    if source_df is None:
        source_df = pd.DataFrame()
    total_candidates = len(source_df)

    if total_candidates > 0:
        options = _build_batch_count_options(total_candidates)
        default_batch_count = default_count or min(5, total_candidates)
        if default_batch_count not in options:
            default_batch_count = options[0]

        st.markdown("---")
        st.markdown(f"## 🤖 {strategy_label}批量深度分析")
        st.caption("直接在当前策略页内完成逐股 AI 深度分析，不再跳转到独立入口。")

        col1, col2, col3 = st.columns([1.2, 1.2, 1.0])
        with col1:
            batch_count = st.selectbox(
                "分析数量",
                options=options,
                index=options.index(default_batch_count),
                key=f"{strategy_key}_batch_count",
                help="对当前策略结果中的前 N 只股票做逐股深度分析",
            )
        with col2:
            analysis_mode = st.selectbox(
                "分析模式",
                options=["sequential", "parallel"],
                index=0,
                key=f"{strategy_key}_batch_mode",
                format_func=lambda value: "顺序分析（稳定）" if value == "sequential" else "并行分析（快速）",
            )
        with col3:
            max_workers = st.number_input(
                "并行线程数",
                min_value=2,
                max_value=5,
                value=3,
                disabled=analysis_mode != "parallel",
                key=f"{strategy_key}_batch_workers",
            )

        preview = extract_batch_candidates(source_df, batch_count)
        if preview:
            preview_text = "、".join(item["symbol"] for item in preview[:10])
            suffix = "..." if len(preview) > 10 else ""
            st.caption(f"待分析股票：{preview_text}{suffix}")

        col_run, col_clear = st.columns([1, 1])
        with col_run:
            if st.button("🚀 开始批量深度分析", type="primary", use_container_width=True, key=f"{strategy_key}_batch_run"):
                with st.spinner(f"正在分析 {batch_count} 只{strategy_label}股票，请稍候..."):
                    from app import analyze_single_stock_for_batch

                    result = run_batch_deep_analysis(
                        candidates=preview,
                        analysis_mode=analysis_mode,
                        max_workers=max_workers,
                        analyzer_fn=analyze_single_stock_for_batch,
                    )
                    result = enrich_batch_result_metadata(
                        strategy_key=strategy_key,
                        result=result,
                    )
                    st.session_state[session_key] = result
                st.rerun()

        with col_clear:
            if st.button("🧹 清空分析结果", use_container_width=True, key=f"{strategy_key}_batch_clear"):
                if session_key in st.session_state:
                    del st.session_state[session_key]
                st.rerun()

    if batch_results:
        display_batch_analysis_results(batch_results, strategy_key=strategy_key)


def display_batch_analysis_results(batch_results: dict[str, Any], strategy_key: str) -> None:
    """Render compact inline batch analysis results."""
    results = batch_results.get("results", [])
    total = batch_results.get("total", len(results))
    success = batch_results.get("success", 0)
    failed = batch_results.get("failed", max(total - success, 0))
    elapsed_time = batch_results.get("elapsed_time", 0.0)
    saved_to_history = batch_results.get("saved_to_history", False)
    save_error = batch_results.get("save_error")

    st.markdown("### 📊 批量分析结果")

    if saved_to_history:
        st.success("✅ 分析结果已自动保存到批量分析历史。")
    elif save_error:
        st.warning(f"⚠️ 历史记录保存失败：{save_error}")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("总计分析", f"{total} 只")
    with col2:
        st.metric("成功分析", f"{success} 只")
    with col3:
        st.metric("失败分析", f"{failed} 只")
    with col4:
        st.metric("总耗时", f"{elapsed_time/60:.1f} 分钟")

    successful_results = [result for result in results if result.get("success")]
    if successful_results:
        table_rows = []
        for result in successful_results:
            final_decision = result.get("final_decision", {}) or {}
            stock_info = result.get("stock_info", {}) or {}
            table_rows.append(
                {
                    "股票代码": stock_info.get("symbol", result.get("symbol", "")),
                    "股票名称": stock_info.get("name", ""),
                    "投资评级": final_decision.get("rating", "N/A"),
                    "信心度": final_decision.get("confidence_level", "N/A"),
                    "进场区间": final_decision.get("entry_range", "N/A"),
                    "目标价": final_decision.get("target_price", "N/A"),
                }
            )
        st.dataframe(pd.DataFrame(table_rows), use_container_width=True, hide_index=True)

        for result in successful_results:
            stock_info = result.get("stock_info", {}) or {}
            final_decision = result.get("final_decision", {}) or {}
            symbol = stock_info.get("symbol", result.get("symbol", ""))
            name = stock_info.get("name", "")
            rating = final_decision.get("rating", "未知")

            with st.expander(f"{symbol} - {name} | {rating}", expanded=False):
                col_left, col_right = st.columns(2)
                with col_left:
                    st.markdown(f"**信心度**: {final_decision.get('confidence_level', 'N/A')}")
                    st.markdown(f"**进场区间**: {final_decision.get('entry_range', 'N/A')}")
                    st.markdown(f"**止盈位**: {final_decision.get('take_profit', 'N/A')}")
                    st.markdown(f"**止损位**: {final_decision.get('stop_loss', 'N/A')}")
                with col_right:
                    st.markdown(f"**目标价**: {final_decision.get('target_price', 'N/A')}")
                    st.markdown(f"**仓位建议**: {final_decision.get('position_size', 'N/A')}")
                    st.markdown(f"**持有周期**: {final_decision.get('holding_period', 'N/A')}")
                    st.markdown(f"**操作建议**: {final_decision.get('operation_advice', '暂无建议')}")

                risk_warning = final_decision.get("risk_warning")
                if risk_warning:
                    st.warning(risk_warning)

    failed_results = [result for result in results if not result.get("success")]
    if failed_results:
        fail_rows = [
            {
                "股票代码": result.get("symbol", ""),
                "错误原因": result.get("error", "未知错误"),
            }
            for result in failed_results
        ]
        st.markdown("#### ❌ 分析失败")
        st.dataframe(pd.DataFrame(fail_rows), use_container_width=True, hide_index=True)


def _build_batch_count_options(total_candidates: int) -> list[int]:
    options = [count for count in [3, 5, 10, 20, 30, 50] if count <= total_candidates]
    if not options:
        return [total_candidates]
    if total_candidates not in options:
        options.append(total_candidates)
        options = sorted(set(options))
    return options


def enrich_batch_result_metadata(strategy_key: str, result: dict[str, Any]) -> dict[str, Any]:
    """Attach optional persistence metadata without changing the core result shape."""
    enriched = dict(result)
    enriched["saved_to_history"] = False
    enriched["save_error"] = None

    if strategy_key != "main_force":
        return enriched

    try:
        from app.main_force_batch_db import batch_db

        batch_db.save_batch_analysis(
            batch_count=enriched["total"],
            analysis_mode=enriched["analysis_mode"],
            success_count=enriched["success"],
            failed_count=enriched["failed"],
            total_time=enriched["elapsed_time"],
            results=enriched["results"],
        )
        enriched["saved_to_history"] = True
    except Exception as exc:
        enriched["save_error"] = str(exc)

    return enriched
