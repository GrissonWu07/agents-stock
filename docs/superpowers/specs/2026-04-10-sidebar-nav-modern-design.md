# Sidebar Navigation Modernization Design

**Date:** 2026-04-10

## Goal

Redesign the main Streamlit sidebar into a more modern and visually calm navigation system.

The current sidebar feels heavy because it combines:

- large white pill buttons
- strong purple background contrast
- repeated expander shells
- too many borders and separators
- a low-value “当前模型” info block that competes with actual navigation

The new sidebar should feel lighter, clearer, and more product-like while preserving all existing navigation destinations.

## Product Outcome

- Keep the same feature coverage and navigation destinations.
- Replace the current oversized button stack with a compact grouped navigation layout.
- Preserve the existing grouping semantics:
  - `选股`
  - `策略`
  - `投资管理`
  - `系统`
- Use a modern card-group pattern with compact nav rows.
- Show a single clear selected state for the active page.
- Remove the sidebar “当前模型” / AI model info block entirely.

## Scope

This design covers:

- the main sidebar navigation in [`C:\Projects\githubs\aiagents-stock\app.py`](C:/Projects/githubs/aiagents-stock/app.py)
- visual grouping and hierarchy of feature navigation
- selected-state styling
- removal of the current model status block from the sidebar

This design does not cover:

- changing the actual page content
- changing feature flags or navigation behavior semantics
- changing environment configuration functionality itself

## Current Problems

The current sidebar has four main UX issues:

1. **Too visually loud**
   - large white buttons on strong purple background create visual noise

2. **Hierarchy is unclear**
   - expanders, large pills, section text, and help text all compete equally

3. **Too much vertical bulk**
   - each nav item consumes too much height, so the sidebar feels long and clumsy

4. **Low-value meta information takes prime space**
   - the current model info block is not needed for routine navigation and should not sit near the top of the sidebar

## Recommended Approach

Use a **card-group navigation** pattern.

That means:

- keep the sidebar structure
- replace heavy expander shells with lighter card groups
- make each section a simple card with:
  - section title
  - compact nav rows
- use compact row items instead of large CTA-like buttons
- show the active page using a distinct selected row style rather than oversized emphasis

This keeps the sidebar familiar while making it much cleaner.

## Information Architecture

### Groups

The sidebar should contain four visual groups:

1. `选股`
2. `策略`
3. `投资管理`
4. `系统`

### Items

The existing destinations remain, but they are rendered as compact rows:

#### 选股

- `主力选股`
- `低价擒牛`
- `小市值策略`
- `净利增长`
- `低估值策略`

#### 策略

- `智策板块`
- `智瞰龙虎`
- `新闻流量`
- `宏观分析`
- `宏观周期`

#### 投资管理

- `持仓分析`
- `量化模拟`
- `历史回放`
- `AI盯盘`
- `实时监测`

#### 系统

- `历史记录`
- `环境配置`

## Visual Language

### Overall Tone

- background: light neutral, not saturated purple-heavy
- cards: white or near-white with soft borders
- spacing: tighter and more deliberate
- emphasis: restrained

### Group Card

Each group should be a rounded rectangle card with:

- subtle border
- soft background
- compact padding
- small section heading

No heavy expander chrome is needed if the groups are always visible.

### Nav Row

Each navigation item should be a compact row, not a large button.

Each row should contain:

- left icon
- label
- optional current-state cue

The row height should be clearly smaller than the current pill buttons.

### Selected State

Only the currently active page should receive strong emphasis.

Recommended selected treatment:

- pale indigo background
- subtle border
- small left accent strip
- darker label color

Unselected rows should remain simple and quiet.

## Remove Current Model Block

The following sidebar block should be removed completely:

- `🤖 AI模型`
- `当前模型: ...`
- `可在「环境配置」中修改模型名称`

Reason:

- it does not help primary navigation
- it creates unnecessary noise near the top of the sidebar
- model configuration already exists on the `环境配置` page

## Interaction Semantics

This redesign should preserve existing behavior:

- clicking a row still sets the same `st.session_state.show_*` flag as before
- the same pages open as today
- navigation resets other mutually exclusive page flags as before

Only presentation changes; routing behavior stays the same.

## Implementation Notes

- Replace expander-based section rendering with direct grouped cards
- Keep existing button keys for stable behavior when possible
- Add dedicated sidebar CSS helpers so the style stays local and maintainable
- Move all sidebar row rendering into a helper so future adjustments do not require touching every individual button block

## Testing Expectations

At minimum, verify:

- sidebar still exposes all existing destinations
- `量化模拟` and `历史回放` remain accessible
- `历史记录` and `环境配置` remain accessible
- the old current-model block is gone
- no duplicate button keys are introduced
- the app still imports and renders successfully

## Acceptance Criteria

The redesign is complete when:

- the sidebar matches the modern grouped-card direction
- it is visually calmer than the current version
- nav rows are more compact than the current large pills
- the active page is easy to identify
- the current-model info block is removed
- navigation behavior is unchanged
