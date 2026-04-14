# REUI Single-Page Workbench Design

**Date:** 2026-04-13

## Goal

Replace the current Streamlit-rendered interface with a modern, independently deployable front-end shell while **keeping the current Python business logic and data flow intact**.

The new UI must:

- use the approved workbench visual direction
- rename the product to **玄武AI智能体股票团队分析系统**
- remain a **single-page application**
- reserve at most one future standalone auth entry such as `login.html`
- define explicit routes for every top-level menu
- support two deployment modes:
  - local/dev mode with a Python API service running alongside the UI
  - Docker mode with an independent `nginx` container serving the UI

This redesign is a **frontend shell migration**, not a backend workflow rewrite.

## Non-Goals

The following are explicitly out of scope for this phase:

- changing backend domain behavior
- redesigning Python service boundaries
- redesigning SQLite schema
- redesigning quant or selector strategies
- introducing backend API contract churn as a prerequisite for the UI migration

The frontend may call the Python API through `/api/*` routes where needed, but the backend capabilities and workflows should stay functionally equivalent.

## Product Name

The product title shown in the new UI should be:

**玄武AI智能体股票团队分析系统**

This title should be used in:

- browser title
- app header / shell branding
- login page if a future `login.html` is added
- Docker/nginx-served UI shell metadata where relevant

## Frontend Architecture

## Recommended Stack

Use a dedicated frontend project under `ui/`:

- `Vite`
- `React`
- `TypeScript`
- `Tailwind CSS`
- `shadcn/ui`
- `TanStack Table`
- `ECharts`

This stack matches the approved visual direction:

- modern workbench
- restrained styling
- clean routing
- high-quality table and chart support
- responsive desktop/mobile adaptation

## Shell Model

The frontend should be a **single-page application** with client-side routing.

There should be one HTML entrypoint:

- `ui/index.html`

Future auth can add:

- `ui/public/login.html`

But the main system must remain a single-page workbench.

## Route Design

The top-level route map should be:

- `/main` — 工作台
- `/discover` — 发现股票
- `/research` — 研究情报
- `/portfolio` — 持仓分析
- `/live-sim` — 量化模拟
- `/his-replay` — 历史回放
- `/ai-monitor` — AI盯盘
- `/real-monitor` — 实时监控
- `/history` — 历史记录
- `/settings` — 环境配置

Optional future route:

- `/login` or standalone `login.html`

The current Streamlit sidebar/session-flag navigation should be treated as legacy behavior to be replaced by explicit front-end routes.

## UI Layout System

## Global Shell

The application shell should have:

- left navigation rail
- top header with product name and current section title
- primary content region
- optional right detail panel only when required by page design

The shell should follow the approved workbench style:

- light gray-blue app background
- soft white cards
- restrained borders and shadows
- one calm blue accent family
- compact controls
- dense but readable data display

## Workbench Page

Route: `/main`

This page remains the product home and should prioritize:

1. summary cards
2. `我的关注`
3. stock analysis module
4. compact next-step navigation

The next-step list should link to:

- 持仓分析
- 实时监控
- AI盯盘
- 发现股票
- 研究情报
- 量化模拟
- 历史回放

## Discover Page

Route: `/discover`

This page aggregates selector-style modules:

- 主力选股
- 低价擒牛
- 小市值
- 净利增长
- 低估值

The page should:

- keep each selector accessible without making each one a separate top-level route
- present recent results clearly
- allow row selection and batch add to `我的关注`

## Research Page

Route: `/research`

This page aggregates research/intelligence modules:

- 智策板块
- 智瞰龙虎
- 新闻流量
- 宏观分析
- 宏观周期

When a module has stock outputs, those outputs should support add-to-watchlist actions.
When a module only provides market context, it remains a pure intelligence surface.

## Portfolio / Monitor / Quant Pages

Routes:

- `/portfolio`
- `/ai-monitor`
- `/real-monitor`
- `/live-sim`
- `/his-replay`

These pages should preserve the current workflow semantics:

- `量化模拟` continues to operate on the shared quant candidate pool
- `历史回放` continues to operate on the same quant candidate pool
- `持仓分析` keeps current portfolio-oriented semantics
- `AI盯盘` and `实时监控` stay independent functional areas

The first migration goal is to **move the UI shell**, not to re-invent these business flows.

## Frontend/Backend Integration

## Integration Principle

Frontend migration should not require a backend redesign.

The React UI should sit on top of the current Python service and reuse current behavior through stable adapter calls. Backend Python modules remain the source of truth for:

- watchlist
- selectors
- research modules
- quant candidate pool
- quant simulation
- replay tasks
- monitoring
- history/configuration

## Migration Requirement

The current Streamlit application and the new UI should be able to coexist during transition:

- Python remains the working application runtime
- the new UI is introduced incrementally
- pages can be migrated one by one behind stable integration boundaries

This avoids a big-bang rewrite.

## Deployment Model

## Development Mode

During initial development:

- Python API service can continue starting locally
- frontend dev server can run alongside it
- the UI uses a local proxy to reach the Python API service

This keeps iteration fast while the shell is rebuilt.

## Docker / Production-Like Mode

Docker deployment should be split into two services:

1. **frontend**
   - served by `nginx`
   - serves built static assets from `ui/dist`
   - handles SPA history fallback

2. **backend**
   - continues running the Python API service

`nginx` should route frontend asset requests directly and proxy backend requests to the Python API service, with `/api/health` as the container health-check path.

This satisfies the requirement that the UI must be able to deploy independently, even if it initially develops side-by-side with Python.

## Directory Design

Add a dedicated frontend project:

- `ui/`

Suggested structure:

- `ui/index.html`
- `ui/package.json`
- `ui/vite.config.ts`
- `ui/src/main.tsx`
- `ui/src/App.tsx`
- `ui/src/routes/`
- `ui/src/components/`
- `ui/src/features/`
- `ui/src/styles/`

Docker-related frontend assets may be referenced from:

- `build/`

without moving existing Python build assets out of place.

## Migration Sequence

The migration should happen in phases:

1. create SPA shell and route map
2. implement shared workbench layout and navigation
3. migrate `/main`
4. migrate `/discover`
5. migrate `/research`
6. migrate `/live-sim` and `/his-replay`
7. migrate `/portfolio`, `/ai-monitor`, `/real-monitor`
8. wire nginx Docker deployment

Each phase should preserve a runnable application.

## Testing Requirements

UI-heavy screenshot tests should stay limited.

Priority should go to:

- route rendering sanity
- page-shell integration tests
- backend workflow tests already in place
- end-to-end smoke tests for the main user path:
  - discover stock
  - add to watchlist
  - add to quant pool
  - run quant simulation / replay

The backend data flow remains the critical regression surface.

## Success Criteria

This redesign is successful when:

- the UI is served from a dedicated `ui/` project
- the product is branded as `玄武AI智能体股票团队分析系统`
- the app is a single-page workbench with explicit routes
- the shell is independently deployable
- Docker can serve the UI through `nginx`
- the current Python service continues to provide the existing business capabilities without required workflow changes
