# Watchlist-Driven Workbench Design

**Date:** 2026-04-11

## Goal

Refocus the product around a clear, user-first operating flow:

`发现股票 -> 关注池 -> 量化候选池 -> 量化模拟 / 历史回放`

The platform should stop feeling like a collection of disconnected strategy pages and instead behave like a coherent investment workbench:

- the user enters the platform and immediately sees the stocks they care about
- selector modules exist to discover candidates
- research modules exist to provide context and occasionally recommend stocks
- quant simulation and replay operate on a deliberately curated quant candidate pool, not on every discovered stock

This is a **workflow and dataflow redesign**, not a full rewrite of every strategy module.

## Product Outcome

After this redesign:

- the home page becomes a **workbench** instead of a single-stock analysis page
- the **关注池** becomes the main object in the product
- `发现股票` becomes a single aggregate page for selector-style modules
- `研究情报` becomes a single aggregate page for research-style modules
- `量化模拟` and `历史回放` share one explicit **量化候选池**
- users no longer need to guess where selector results go after a strategy finishes
- selector output, watchlist actions, analysis actions, quant simulation, and holdings all belong to one understandable flow

## Core Product Objects

### 1. 发现股票

This is the discovery layer.

It includes pure selector modules:

- `主力选股`
- `低价擒牛`
- `小市值`
- `净利增长`
- `低估值`

Responsibilities:

- run discovery logic
- display result tables
- allow **single add** and **batch add** into `关注池`
- preserve recent selector results

This layer should **not** own downstream quant workflow decisions.

### 2. 研究情报

This is the intelligence/context layer.

It includes:

- `智策板块`
- `智瞰龙虎`
- `新闻流量`
- `宏观分析`
- `宏观周期`

Responsibilities:

- present board/market/news/macro intelligence
- help explain market context and direction
- when a module has explicit stock outputs, allow **single add** and **batch add** into `关注池`
- when a module does not produce clear stock outputs, keep it as pure intelligence

Research modules should not be forced into a selector-shaped workflow.

### 3. 关注池

This is the global main pool and the most important user-facing object.

The user enters the platform and should first see:

- the stocks they care about
- real-time prices
- where each stock came from
- current status / latest signal summary
- quick next actions

Responsibilities:

- store watched stocks from selectors, research outputs, and manual addition
- serve as the primary operational view on the home workbench
- support **single-stock analysis** and **multi-stock analysis**
- support **single add** and **batch add** into `量化候选池`

### 4. 量化候选池

This is a shared quant-validation pool.

It is populated **manually from `关注池`**, not directly from selector pages.

Responsibilities:

- serve as the input set for `量化模拟`
- serve as the input set for `历史回放`
- support single and batch add/remove operations

`量化模拟` and `历史回放` must use the **same quant candidate pool**.

## Approved Workflow

### A. Enter Platform

The user lands on the **工作台**.

The workbench should emphasize:

- `关注池` as the main visual region
- `股票分析` directly below the watchlist
- a light right-side "下一步" rail containing:
  - `持仓分析`
  - `实时监控`
  - `AI盯盘`
  - `发现股票`
  - `研究情报`
  - `量化模拟`
  - `历史回放`

These are navigation entry points only. They do not need to dominate the page.

### B. Discover Stocks

The user opens `发现股票`.

Inside this aggregate page, the selector modules are presented as one grouped experience rather than many first-level navigation entries.

After running a selector:

- the result remains visible in that selector view
- each row supports `加入关注池`
- the result toolbar supports `批量加入关注池`
- results are not auto-inserted into `关注池`

### C. Use Research / Intelligence

The user opens `研究情报`.

Inside this aggregate page, research modules are grouped into one experience.

If a module produces explicit stock outputs:

- each stock can be added to `关注池`
- batch add is allowed where the module naturally produces a list

If a module does not produce explicit stock outputs:

- it remains a pure analysis surface

### D. Curate the Watchlist

From the workbench or a dedicated watchlist view, the user manages `关注池`:

- manual add
- remove
- single-stock analysis
- multi-stock analysis
- add to quant candidate pool

The watchlist is the main operational pool for human decision-making.

### E. Quant Validation

From `关注池`, the user manually promotes selected stocks into `量化候选池`.

From there:

- `量化模拟` works on the shared quant candidate pool
- `历史回放` works on the same shared quant candidate pool

This separation prevents every watched stock from automatically entering quant workflows.

## Navigation Design

The sidebar should be simplified to a smaller set of first-level product areas.

Recommended first-level navigation:

- `工作台`
- `发现股票`
- `研究情报`
- `持仓分析`
- `实时监控`
- `AI盯盘`
- `量化验证`

Inside `量化验证`, the product can expose:

- `量化模拟`
- `历史回放`

or keep them as two tightly grouped pages under the same top-level product area.

The important change is:

- selector modules should not each occupy a first-level sidebar slot
- research modules should not each occupy a first-level sidebar slot

## Page Structure

### 1. 工作台

#### Main Region

- `关注池` main table/card area

Suggested fields:

- 股票代码
- 股票名称
- 实时价格
- 涨跌幅
- 来源
- 加入时间
- 最近分析时间
- 最新信号摘要
- 是否已进入量化候选池

Suggested actions:

- `分析`
- `批量分析`
- `加入量化候选池`
- `批量加入量化候选池`
- `删除`

#### Below Watchlist

- `股票分析`
  - reuse current analysis capability
  - supports single-stock and multi-stock entry based on selected watchlist rows

#### Right Rail

Compact next-step navigation only:

- 持仓分析
- 实时监控
- AI盯盘
- 发现股票
- 研究情报
- 量化模拟
- 历史回放

No large "research module" cards should dominate this area.

### 2. 发现股票

Aggregate page containing:

- 主力选股
- 低价擒牛
- 小市值
- 净利增长
- 低估值

Each module keeps its own parameter set and result rendering, but the page-level experience becomes unified:

- common page header
- module switcher/tabs
- result tables with watchlist actions

### 3. 研究情报

Aggregate page containing:

- 智策板块
- 智瞰龙虎
- 新闻流量
- 宏观分析
- 宏观周期

The shared rule:

- analysis first
- add-to-watchlist actions only when explicit stock outputs exist

### 4. 量化模拟

Do **not** perform a large structural rewrite in this phase.

Scope for this redesign:

- explicitly align the page with the shared `量化候选池`
- make page copy and interactions reflect that the pool comes from `关注池`
- keep current candidate-pool-based simulation structure

### 5. 历史回放

Do **not** perform a large structural rewrite in this phase.

Scope for this redesign:

- explicitly align replay with the same shared `量化候选池`
- keep current replay/reporting structure
- ensure workflow language is consistent with the new hierarchy:
  - discover
  - watch
  - quant validate

## Dataflow Design

### Existing Problems

Current state is confusing because:

1. selector results live in multiple places
   - `st.session_state`
   - `data/selector_results/*.json`
   - strategy-page-local views

2. current `quant_sim candidate_pool` is overloaded
   - it partially acts like a watchlist
   - partially acts like a quant pool

3. research and selector outputs do not flow into one clearly visible operational object

### Target Dataflow

The target dataflow should be:

`发现股票 / 研究情报(stock output) -> 关注池 -> 量化候选池 -> 量化模拟 / 历史回放 -> 结果摘要回写`

### Data Objects

#### `discovery_results`

Keep existing selector recent-result storage patterns for now.

This is not the long-term main business object.

It remains a recent-result layer used by selector pages.

#### `watchlist`

Introduce a formal persisted watchlist layer.

This becomes the main product object for:

- the workbench
- cross-page stock state
- add/remove actions
- analysis entry
- quant-candidate promotion

#### `quant_candidate_pool`

Continue to use the existing quant candidate pool concept, but explicitly narrow its semantics:

- it is a quant-validation pool only
- it is populated from `watchlist`
- it is shared by realtime quant simulation and replay

### Result Feedback

Quant outputs should not live in isolation.

The watchlist should be able to show lightweight summary feedback from quant workflows, such as:

- latest signal summary
- latest replay result summary
- whether the stock is currently in the quant candidate pool

This makes the workbench feel connected without forcing deep quant detail into the main table.

## Why the Current System Feels Slow

The user-visible "slowness" is not just raw API latency. It comes from workflow fragmentation.

### 1. Heavy Selector Pipelines

Some selectors, especially `主力选股`, are inherently heavy:

- upstream data fetch
- filtering
- multiple AI analysis passes
- final synthesis

### 2. Repeated Analysis

Because outputs are not centered around a single main pool, users often repeat:

- selector runs
- single-stock analyses
- candidate promotion decisions

### 3. Result Destination Ambiguity

When users do not know where results go, the product feels slower even before APIs are optimized.

### 4. Quant Candidate Pool Semantic Confusion

If users must mentally interpret the existing quant pool as both:

- a watchlist
- and a quant pool

then every workflow becomes harder than it needs to be.

This redesign addresses those problems first through better flow and object boundaries.

## Scope and Non-Goals

### In Scope

- new workbench-first information architecture
- formal `watchlist` concept
- clear `watchlist -> quant candidate pool` promotion flow
- aggregate pages for selectors and research modules
- watchlist-centered homepage design
- navigation simplification
- language cleanup for quant simulation and replay semantics

### Out of Scope for This Phase

- rewriting selector algorithms
- rewriting research algorithms
- major structural rewrites of `量化模拟` and `历史回放`
- changing live broker behavior
- removing existing selector modules

## Technical Approach

Use a **light refactor**:

- keep existing selector module logic
- keep existing research module logic
- add a real watchlist service + persistence + UI
- aggregate existing modules into two new page-level containers:
  - `发现股票`
  - `研究情报`
- keep current quant simulation and replay engines, but align their inputs and terminology

This approach minimizes risk while materially improving the product workflow.

## Testing Strategy

The testing priority for this redesign is:

- **fewer UI-specific tests**
- **stronger backend dataflow coverage**

### UI Testing

UI tests should stay focused and minimal:

- page routing sanity
- major controls appear
- main workflow entry points exist

No large snapshot-style UI test suite is required.

### Backend / Dataflow Testing

The backend test suite must explicitly cover the end-to-end object flow:

1. `发现股票 -> 关注池`
   - single add
   - batch add

2. `研究情报(stock output) -> 关注池`
   - only when explicit stock outputs exist

3. `关注池 -> 分析`
   - single-stock analysis
   - multi-stock analysis input generation

4. `关注池 -> 量化候选池`
   - single add
   - batch add
   - remove

5. `量化候选池 -> 量化模拟`
   - candidate set used correctly
   - results stored correctly

6. `量化候选池 -> 历史回放`
   - replay consumes only quant candidate stocks
   - outputs persist correctly

7. `量化结果 -> 持仓/状态摘要`
   - watchlist-visible summaries update correctly

This phase should bias toward **system dataflow correctness** instead of spending most effort on UI test density.

## Recommended Implementation Sequence

### Phase 1

Create formal `watchlist` support:

- persistence
- service layer
- basic UI rendering

### Phase 2

Rebuild the home page into the workbench:

- watchlist first
- stock analysis below
- next-step rail on the right

### Phase 3

Create `发现股票` aggregate page:

- wrap existing selector modules
- unify add-to-watchlist actions

### Phase 4

Create `研究情报` aggregate page:

- wrap existing research modules
- allow add-to-watchlist only when stock outputs exist

### Phase 5

Align quant workflows:

- explicit `watchlist -> quant candidate pool`
- terminology cleanup in `量化模拟`
- terminology cleanup in `历史回放`

### Phase 6

Add dataflow-heavy tests and then optimize obvious bottlenecks.

## Success Criteria

This redesign is successful when:

- the user enters the app and immediately sees a meaningful `关注池`
- selector pages clearly feed into `关注池`
- research pages only feed into `关注池` when stock outputs exist
- the user can manually promote watched stocks into the shared `量化候选池`
- quant simulation and replay both clearly operate on that shared pool
- the platform no longer feels like every page starts a different mini-product
- backend tests prove the full flow:
  - discover
  - watch
  - analyze
  - quant validate
  - holdings / state update
