# Quant Replay Menu Design

**Date:** 2026-04-10

**Goal**

Split historical replay out of the current `量化模拟` page into its own top-level Streamlit menu while reusing the same replay engine, persistence, and result-reporting stack. The new replay page must open directly into replay configuration, running status, and replay history details without hiding core controls inside an expander.

**Product Outcome**

- The sidebar exposes a dedicated `🕰️ 历史回放` entry above or adjacent to `🧪 量化模拟`.
- `🧪 量化模拟` focuses on realtime simulation only.
- `🕰️ 历史回放` focuses on historical replay and continuous replay only.
- The replay page opens directly into configuration and current-task status with no replay-specific expander gate.
- Replay history clearly shows:
  - replay overview
  - per-signal execution records
  - applied strategy profile for each signal
  - per-stock holding outcomes
  - trade analysis and equity results

## Scope

This design covers:

- adding a dedicated sidebar menu and view state for historical replay
- moving replay-specific controls out of the current `quant_sim` main page
- preserving shared replay runner, replay service, and replay database tables
- expanding replay result presentation so a user can inspect detailed execution history
- keeping all replay behavior inside the main Streamlit app

This design does not cover:

- changing the underlying replay execution semantics
- changing live broker behavior
- adding new markets or granularities beyond what the current replay engine already supports

## Current Problem

Today, historical replay is embedded inside [`C:\Projects\githubs\aiagents-stock\quant_sim\ui.py`](C:/Projects/githubs/aiagents-stock/quant_sim/ui.py) under the main `量化模拟` page. That creates three UX issues:

1. realtime simulation and historical replay compete for screen space and attention
2. replay must be opened from an expander before configuration is visible
3. replay results are present, but they are not framed as a dedicated replay workflow and the detailed execution history is harder to discover than it should be

The product should instead treat historical replay as its own workflow.

## Recommended Approach

Use **shared services with separate menu pages**.

That means:

- keep one backend stack:
  - `QuantSimReplayService`
  - `QuantSimReplayRunner`
  - replay result tables in `QuantSimDB`
- separate the frontend entrypoints:
  - `display_quant_sim()` for realtime simulation
  - `display_quant_replay()` for historical replay
- keep shared UI helpers in the same module or a replay helper module, but make the menu entry and top-level layout distinct

This is the lowest-risk approach because it improves product clarity without duplicating business logic.

## Information Architecture

### Sidebar

Under the investment-management section in [`C:\Projects\githubs\aiagents-stock\app.py`](C:/Projects/githubs/aiagents-stock/app.py), the user should see:

- `🧪 量化模拟`
- `🕰️ 历史回放`
- `🤖 AI盯盘`
- `📡 实时监测`

The new replay button sets a dedicated page state, for example:

- `show_quant_replay`

When `show_quant_replay` is active, the app should render only the replay page and should clear other feature flags the same way the existing navigation already does.

### Page Responsibilities

#### `🧪 量化模拟`

This page should keep only realtime simulation concerns:

- account summary
- scheduler status
- scheduler configuration
- immediate candidate scan
- candidate pool
- realtime strategy signals
- pending actions
- positions
- trade history
- equity snapshots

This page should no longer contain the replay configuration form or replay results tab.

#### `🕰️ 历史回放`

This page should keep only replay concerns:

- replay task overview
- replay configuration form
- current replay status
- replay run selector
- replay result report
- replay history details

The replay page should not include realtime-only tabs such as candidate pool management or pending manual execution.

## Replay Page Layout

The replay page should open directly into a full replay workflow without a replay expander.

Recommended vertical layout:

1. page title and short replay-specific caption
2. current replay status card
3. replay configuration form
4. replay result selector and report

### 1. Header

Title:

- `🕰️ 历史回放`

Caption should explain:

- this page runs strategy replay over historical checkpoints
- replay processes checkpoints continuously rather than waiting for real-world time
- results include trades, strategy decisions, holdings, and equity outcomes

### 2. Current Replay Status

Always visible at the top of the page.

Show:

- run id
- mode
- status
- progress current / total
- latest checkpoint
- current status message
- recent events
- cancel action when cancellable

This should reuse the current replay status panel logic instead of duplicating it.

### 3. Replay Configuration

Always visible, not hidden in an expander.

Inputs:

- replay mode
  - `历史区间回放`
  - `从过去接续到实时自动模拟`
- start date
- start time
- optional end date
- optional end time
- checkbox or explicit toggle for “结束时间留空则回放到当前时刻”
- timeframe selector
  - `30m`
  - `1d`
  - `1d+30m`
- market selector
- `覆盖当前实时模拟账户`
- `回放完成后自动启动定时分析`

Action button:

- `▶️ 开始区间模拟` or the continuous variant label

The default timeframe remains `30m`.

### 4. Replay Result Report

Below the configuration, show a report for a selected replay run.

The user must be able to choose from prior replay runs, not only inspect the latest one.

## Replay Report Requirements

The replay report must clearly answer:

- what configuration was used
- what happened at signal level
- what got executed
- what the ending positions look like
- what the performance outcome was

### A. Replay Overview

Show:

- run id
- mode
- status
- market
- timeframe
- start datetime
- end datetime
- initial cash
- final available cash
- final market value
- final total equity
- total return
- max drawdown
- win rate
- trade count
- checkpoint count

### B. Strategy Summary

For the selected run, clearly summarize the strategy context:

- dominant market regime labels observed
- dominant fundamental-quality labels observed
- dominant risk-style labels observed
- timeframe mode
- key threshold summary if available

This can be a compact summary card derived from persisted replay signals.

### C. Per-Signal Execution History

This is a required detailed section.

Each replay signal row should show:

- checkpoint time
- stock code
- stock name
- action
- confidence
- reasoning
- market regime
- fundamental quality
- risk style
- timeframe
- decision type
- whether it was executed
- executed quantity if executed
- executed price if executed
- execution outcome
- if not executed, the reason

This requires joining replay signals with replay trades and/or execution metadata.

If the same signal is transformed into a truncated sell because sellable quantity was smaller than requested, the record should show:

- original intended action
- actual executed quantity
- execution note or adjustment reason

### D. Trade Ledger

Each replay trade row should show:

- execution time
- stock code
- stock name
- action
- price
- quantity
- amount
- realized pnl
- note

Aggregates should include:

- total buy amount
- total sell amount
- total realized pnl
- winning trades
- losing trades
- average realized pnl

### E. Per-Stock Holding Outcome

This is another required detailed section.

For each stock touched by the replay, show:

- stock code
- stock name
- buy count
- sell count
- ending quantity
- sellable quantity
- locked quantity
- average cost
- ending price
- market value
- unrealized pnl
- realized pnl contribution if derivable
- total pnl contribution if derivable

This section must not be limited to “still open positions only”. It should represent the replay outcome per stock, including names that were fully closed during the run.

### F. Equity and Snapshots

Show:

- equity curve
- detailed snapshot table
- recent run events

If the run failed or was cancelled, the report must still show partial results.

## Persistence Requirements

The replay page depends on persisted detail. The UI cannot reconstruct all of this from the latest in-memory state.

Required persisted data:

- replay run row in `sim_runs`
- replay checkpoints in `sim_run_checkpoints`
- replay trades in `sim_run_trades`
- replay ending positions in `sim_run_positions`
- replay strategy signals in `sim_run_signals`
- replay events in `sim_run_events`

To support signal-level execution history cleanly, the persistence layer should also carry enough linkage to determine whether a replay signal was executed and how. This can be implemented by:

- adding execution status/quantity/price/note fields to `sim_run_signals`, or
- adding a signal-to-trade linkage table, or
- enriching the replay result builder with deterministic matching logic using signal checkpoint + stock + action

The implementation should choose the simplest durable model that remains readable and testable.

## Code Organization

Recommended structure:

- keep [`C:\Projects\githubs\aiagents-stock\quant_sim\ui.py`](C:/Projects/githubs/aiagents-stock/quant_sim/ui.py) as the home of shared quant UI helpers
- add a dedicated top-level render function:
  - `display_quant_replay()`
- keep or extract shared helpers:
  - `render_replay_status_panel()`
  - replay config builder helpers
  - replay report builder helpers
  - strategy profile summary helpers

If `quant_sim/ui.py` becomes too large, it is acceptable to split replay-only rendering into a new module such as:

- `C:\Projects\githubs\aiagents-stock\quant_sim\replay_ui.py`

But that split is optional for this iteration. The main requirement is clear UI separation, not a mandatory file split.

## Testing Strategy

Mandatory tests:

- navigation test covering the new `show_quant_replay` state
- UI source or behavior test showing `🕰️ 历史回放` as a dedicated page entry
- test that replay configuration is directly visible on the replay page without an expander gate
- test that `量化模拟` no longer includes the replay block
- test that replay result payload includes:
  - initial cash
  - final cash
  - final market value
  - total equity
  - signal list
  - trade list
  - per-stock holding outcome
- test that replay signal rows expose applied strategy profile fields
- test that replay history can be built from a selected run, not only the latest run

## Review Protocol

This work must still follow the existing review protocol:

1. code/spec review
2. runtime verification review

No implementation phase completes while either review still has blocking findings.

## Completion Criteria

This feature is complete when:

- the main menu contains a dedicated `🕰️ 历史回放` page
- the replay workflow is no longer buried under the realtime simulation page
- replay configuration is immediately visible when entering the replay page
- replay results show complete report-style detail
- replay history includes per-signal execution detail, applied strategy profile, and per-stock holding outcome
- `量化模拟` remains focused on realtime simulation only
