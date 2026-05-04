# BUY Tier Portfolio Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement BUY strength tiers and portfolio-level defensive gates for both live simulation and historical replay.

**Architecture:** Add a focused `portfolio_execution_guard` module for policy defaults, normalization, derived metrics, strength scoring, tiering, and portfolio gate evaluation. Integrate it into `SignalCenterService` after stock execution feedback and before transaction-cost handling, then make capital slot sizing honor the new gate multiplier. Keep live and replay isolated by reading summaries from the current `QuantSimDB` instance.

**Tech Stack:** Python, SQLite-backed `QuantSimDB`, existing pytest test suite, React/TypeScript settings UI in a later task.

---

### Task 1: Pure Guard Policy And BUY Tier Evaluation

**Files:**
- Create: `app/quant_sim/portfolio_execution_guard.py`
- Create: `tests/test_portfolio_execution_guard.py`

- [ ] Write failing tests for profile-specific defaults, weight normalization, weak/normal/strong BUY tiering, T+1 downgrade, and Data Contract fields.
- [ ] Implement `default_portfolio_execution_guard_policy()`, `normalize_portfolio_execution_guard_policy()`, and `evaluate_portfolio_execution_guard()`.
- [ ] Run `python -m pytest tests\test_portfolio_execution_guard.py -q`.

### Task 2: Capital Slot Gate Multiplier Integration

**Files:**
- Modify: `app/quant_sim/capital_slots.py`
- Modify: `tests/test_quant_sim_capital_slots.py`

- [ ] Add failing test proving `portfolio_execution_guard.status=downgraded` scales slot units once and `size_multiplier=0.0` is preserved.
- [ ] Include `portfolio_execution_guard` in `gate_size_multiplier()`.
- [ ] Run `python -m pytest tests\test_quant_sim_capital_slots.py -q`.

### Task 3: SignalCenter Integration

**Files:**
- Modify: `app/quant_sim/signal_center_service.py`
- Modify: `tests/test_portfolio_execution_guard.py`

- [ ] Add failing tests for `create_signal()` storing `strategy_profile.portfolio_execution_guard`, downgrading weak BUY, and blocking portfolio-budget BUY.
- [ ] Add `_apply_portfolio_execution_guard()` after `_apply_stock_execution_feedback()`.
- [ ] Ensure downgraded gates do not pre-multiply `position_size_pct`.
- [ ] Run `python -m pytest tests\test_portfolio_execution_guard.py tests\test_stock_execution_feedback.py -q`.

### Task 4: Portfolio Summary Provider

**Files:**
- Modify: `app/quant_sim/db.py`
- Modify: `tests/test_portfolio_execution_guard.py`

- [ ] Add failing tests for portfolio summary windows using the active DB only.
- [ ] Implement summary method for recent stops, realized PnL, drawdown, and market environment ratios.
- [ ] Run `python -m pytest tests\test_portfolio_execution_guard.py -q`.

### Task 5: Strategy Defaults And UI Configuration

**Files:**
- Modify: `app/quant_sim/db.py`
- Modify: `app/quant_kernel/config.py`
- Modify: `ui/src/features/settings/strategy-config-page.tsx`
- Modify: `ui/src/tests/strategy-config-page.test.tsx`

- [ ] Add failing tests that aggressive/stable/conservative retain distinct policy values through config normalization.
- [ ] Add defaults to builtin strategy profiles.
- [ ] Add settings UI fields for BUY tier, portfolio guard, cold start, and market guard.
- [ ] Run backend and frontend targeted tests.

### Task 6: Signal UI Display

**Files:**
- Modify signal list/detail components and tests after locating current render paths.

- [ ] Add failing UI tests for `buy_tier_label`, `buy_strength_score`, `is_late_rebound`, `late_rebound_reasons`, and `portfolio_guard.reasons`.
- [ ] Render badges and detail rows.
- [ ] Run frontend tests.

### Task 7: Verification

**Files:**
- No new files expected.

- [ ] Run backend targeted test suite.
- [ ] Run frontend build/test target used by this repo.
- [ ] Re-run a small local replay and confirm BUY tier fields are stored on signals.
