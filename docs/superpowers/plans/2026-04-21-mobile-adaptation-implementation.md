# Mobile & Tablet Adaptation (<=1200px) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver full mobile+tablet usability for key pages at `<=1200px` while keeping desktop (`>1200px`) behavior unchanged.

**Architecture:** Implement a compact-table responsive layer guarded by media rules and component-level compact branches. Keep business handlers unchanged; only adapt rendering and interaction shells (core columns, row expansion, per-row more menu, toolbar wrapping, table-shell horizontal overflow fallback).

**Tech Stack:** React + TypeScript + existing CSS system (`ui/src/styles/globals.css`) + existing page/components.

---

## Scope & File Map

### Create

- `ui/src/lib/use-compact-layout.ts`

### Modify

- `ui/src/styles/globals.css`
- `ui/src/features/quant/quant-table-section.tsx`
- `ui/src/features/quant/live-sim-page.tsx`
- `ui/src/features/quant/his-replay-page.tsx`
- `ui/src/features/workbench/watchlist-panel.tsx`
- `ui/src/features/workbench/workbench-page.tsx`
- `ui/src/features/quant/signal-detail-page.tsx`
- `ui/src/features/discover/discover-page.tsx`
- `ui/src/features/research/research-page.tsx`
- `ui/src/features/portfolio/portfolio-page.tsx`

---

### Task 1: Responsive foundation (CSS + compact detector)

**Files:**
- Create: `ui/src/lib/use-compact-layout.ts`
- Modify: `ui/src/styles/globals.css`

- [ ] Add `useCompactLayout` hook (window width + media query listener) for `<=1200px`.
- [ ] Add global compact utilities in CSS:
  - `table-shell` internal horizontal overflow for compact mode.
  - compact table core/detail row helpers.
  - row expand button, more-menu styles, touch target minimums (`44x44`).
  - toolbar wrapping + reduced control widths for compact mode.
- [ ] Add `@media (max-width:1200px)` overrides for pages called out in spec (watchlist/quant/research/discover/portfolio).
- [ ] **Review pass 1:** check Task 1 changes against spec sections 3.1 / 7.1 / 8.3 / 8.4.
- [ ] **Review pass 2:** check code consistency and desktop guardrails (`>1200px` unchanged path).

### Task 2: Shared quant table compact mode

**Files:**
- Modify: `ui/src/features/quant/quant-table-section.tsx`

- [ ] Extend `QuantTableSectionCard` with optional compact config:
  - core column index list
  - detail column index list (or derived remainder)
  - compact action menu support
- [ ] Implement row expand/collapse in compact mode.
- [ ] Implement per-row `⋯` action menu in compact mode; keep existing action rendering on desktop.
- [ ] Preserve existing `onRowAction` and current data model.
- [ ] **Review pass 1:** validate against spec sections 5.2 / 6.2 / 6.3 / 6.6.
- [ ] **Review pass 2:** ensure no desktop regression in default branch.

### Task 3: Live sim + replay page wiring

**Files:**
- Modify: `ui/src/features/quant/live-sim-page.tsx`
- Modify: `ui/src/features/quant/his-replay-page.tsx`

- [ ] Replace fixed-width + nowrap toolbar rules with responsive compact behavior.
- [ ] Configure compact core/detail columns for signal/trade tables.
- [ ] Remove replay metric inline forced 4-column style and defer to responsive grid.
- [ ] Keep existing filters/paging/handlers intact.
- [ ] **Review pass 1:** validate against spec sections 6.2 / 6.3 / 9.2 / 9.3.
- [ ] **Review pass 2:** ensure pagination/filter usability at compact widths.

### Task 4: Workbench watchlist compact mode + Next step layout

**Files:**
- Modify: `ui/src/features/workbench/watchlist-panel.tsx`
- Modify: `ui/src/features/workbench/workbench-page.tsx`
- Modify: `ui/src/styles/globals.css` (if needed for workbench ordering)

- [ ] Implement watchlist compact table:
  - core columns
  - expandable details
  - per-row `⋯` menu for actions
- [ ] Adjust watchlist toolbar cluster shrinking/wrapping for compact mode.
- [ ] Ensure `Next step` panel moves to bottom at `<=1200px`.
- [ ] **Review pass 1:** validate against spec sections 6.1 / 6.6 / 9.2.
- [ ] **Review pass 2:** verify row selection + action click behavior stays correct.

### Task 5: Signal detail compact data tables

**Files:**
- Modify: `ui/src/features/quant/signal-detail-page.tsx`

- [ ] Add compact rendering for multi-column tables on this page:
  - core columns visible in main row
  - detail fields in expandable row
  - maintain current localization and value formatting logic
- [ ] Ensure all signal detail table wrappers are internally scrollable, not page-scroll inducing.
- [ ] **Review pass 1:** validate against spec sections 6.4 / 6.6 / 9.2 / 9.3.
- [ ] **Review pass 2:** verify interaction conflict rules (expand/menu/scroll) are implemented.

### Task 6: P3 pages compact toolbar cleanup

**Files:**
- Modify: `ui/src/features/discover/discover-page.tsx`
- Modify: `ui/src/features/research/research-page.tsx`
- Modify: `ui/src/features/portfolio/portfolio-page.tsx`
- Modify: `ui/src/styles/globals.css`

- [ ] Remove/override fixed min-width controls at compact widths.
- [ ] Make toolbar controls wrap and preserve action visibility.
- [ ] **Review pass 1:** validate against spec section 6.5 / 9.2 / 9.3.
- [ ] **Review pass 2:** ensure desktop layout remains unchanged.

### Task 7: Final alignment audit (requirements/spec/code)

**Files:**
- Modify: `docs/superpowers/specs/2026-04-21-mobile-adaptation-design.md` (only if mismatch notes are needed)

- [ ] Run a full alignment checklist:
  - user requirements
  - approved spec
  - implemented code paths
- [ ] Produce “done / gap” matrix by page and width buckets (spec 9.3).
- [ ] If mismatch exists, patch code and re-run two-pass review per affected task.

---

## Execution Notes

1. All compact behavior is gated (`<=1200px`) and should not alter desktop branches.
2. Existing business actions must be reused, not reimplemented.
3. No backend/API contract changes.
4. For each task, perform two explicit review passes before moving on.

