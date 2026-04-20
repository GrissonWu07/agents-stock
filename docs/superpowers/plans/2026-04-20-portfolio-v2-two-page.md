# Implementation Plan: Portfolio v2 Two-Page

Spec:

- `C:\Projects\githubs\aiagents-stock\docs\superpowers\specs\2026-04-20-portfolio-v2-two-page-design.md`

## 1. Scope

Implement two-page portfolio UX and `/api/v1/portfolio_v2` contract alignment:

1. `/portfolio` holdings list page
2. `/portfolio/position/:symbol` position detail page

## 2. Work items

1. Backend routing and contract alignment
   - [ ] Add/align `GET /api/v1/portfolio_v2`
   - [ ] Add/align `GET /api/v1/portfolio_v2/positions/{symbol}`
   - [ ] Add/align `POST /api/v1/portfolio_v2/actions/refresh-indicators`
   - [ ] Keep `refresh-indicators` strictly indicators-only

2. Frontend route split
   - [ ] Keep `/portfolio` as list page only
   - [ ] Add `/portfolio/position/:symbol` page
   - [ ] Row click navigation and detail back navigation

3. List page UX
   - [ ] Full holdings table
   - [ ] Filter / sort / pagination
   - [ ] Refresh policy: selected rows first, otherwise current page
   - [ ] Remove pending-signal-count column
   - [ ] Add market key realtime news section below table
   - [ ] Remove batch realtime analysis button
   - [ ] Add realtime portfolio analysis (overall rebalance recommendation)

4. Detail page UX
   - [ ] First screen: K line + indicators
   - [ ] Pending signals section
   - [ ] Position edit section
   - [ ] Realtime analyze section
   - [ ] Remove analysis-history block

5. Compatibility and tests
   - [ ] Update client endpoints to `portfolio_v2`
   - [ ] Update route/header behavior for detail path
   - [ ] Update endpoint/unit tests for new paths

## 3. Verification checklist

1. `/portfolio` can view all holdings with filter/sort/pagination.
2. Clicking row enters `/portfolio/position/:symbol`.
3. Detail first screen is K line + indicators.
4. Repeated indicator refresh does not mutate non-technical fields.
5. Position update persists and reflects in both pages.

## 4. Out of scope (this round)

1. Full trade-lot accounting redesign (FIFO realized PnL engine) if existing storage can satisfy current UI.
2. New brokerage integration.
