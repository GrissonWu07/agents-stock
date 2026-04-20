# Portfolio v2 Two-Page Design Spec

Date: 2026-04-20  
Status: Approved for implementation

## 1. Goal

Rebuild portfolio analysis into two explicit pages:

1. `/portfolio`: a full holdings list page for viewing all current holdings.
2. `/portfolio/position/:symbol`: a single-stock detail page for deep analysis.

Additional constraints from latest requirements:

1. The list page does not include batch realtime analysis.
2. The list table does not include pending signal count.
3. Add a market key realtime news section below the holdings list.
4. Realtime analysis should evaluate overall portfolio positions and whether rebalance is needed.
5. Technical refresh is indicators-only and must not mutate non-technical state.

## 2. Routing and IA

### 2.1 Pages

1. Holdings list page: `/portfolio`
2. Position detail page: `/portfolio/position/:symbol`

### 2.2 Navigation

1. Click row on `/portfolio` to navigate to `/portfolio/position/:symbol`.
2. Detail page provides a return action to `/portfolio`.

## 3. Holdings List Page (`/portfolio`)

### 3.1 Purpose

One complete page for global holdings management and portfolio-level decisions.

### 3.2 Top metrics

1. Holding count
2. Portfolio return
3. Max drawdown
4. Available cash

### 3.3 Main table columns

1. Symbol
2. Name
3. Sector
4. Quantity
5. Avg cost
6. Last price
7. Unrealized PnL pct
8. Score (0-100)

Excluded by requirement:

1. Pending signal count column

### 3.4 Actions on list page

1. `Refresh portfolio`
2. `Refresh technical`
3. `Realtime portfolio analysis` (overall position adjustment recommendation)

No `batch realtime analysis` button is shown.

### 3.5 News section below list

Add section: `Market key realtime news`

1. Show top N items by importance and recency.
2. Each item includes title, source, publish time, short summary.
3. Optional link when URL exists.

## 4. Position Detail Page (`/portfolio/position/:symbol`)

### 4.1 Section order

1. Header summary (symbol/name/sector + actions)
2. First screen: K line + technical indicators (same row)
3. Pending signals
4. Position edit form
5. Realtime analysis conclusion

Removed:

1. Analysis history block

### 4.2 First screen detail

Left:

1. K line chart with timeframe switch

Right:

1. Indicator cards (MA/RSI/MACD/KDJ/BOLL/volume etc.)
2. Indicator explanations

Header actions:

1. `Refresh technical` (current symbol only)
2. `Realtime analyze` (single-stock analysis)

## 5. Portfolio-level realtime analysis

`Realtime portfolio analysis` produces one overall recommendation:

1. Current portfolio position status
2. Suggested action: increase / keep / reduce
3. Suggested target exposure ratio
4. Key reasons based on current holdings analysis distribution

Output is shown on list page in a dedicated summary card.

## 6. API Contract (`/api/v1/portfolio_v2`)

### 6.1 Snapshot APIs

1. `GET /api/v1/portfolio_v2`
   - Holdings-list snapshot with portfolio-level analysis and market news section
2. `GET /api/v1/portfolio_v2/positions/{symbol}`
   - Detail snapshot for one symbol

### 6.2 Actions

1. `POST /api/v1/portfolio_v2/actions/refresh-portfolio`
2. `POST /api/v1/portfolio_v2/actions/refresh-indicators`
3. `POST /api/v1/portfolio_v2/actions/analyze`
4. `PATCH /api/v1/portfolio_v2/positions/{symbol}`

### 6.3 refresh-indicators request

```json
{
  "symbols": ["600531", "301662"],
  "selectedSymbol": "600531",
  "scope": "indicators_only"
}
```

Hard rule:

1. Update only technical indicator and K line data blocks.
2. Do not update quantity/cost/trade records/signal execution statuses.

## 7. Data consistency

1. List and detail technical sections for same symbol should align on technical update time.
2. Portfolio-level realtime analysis updates only portfolio-analysis section, not technical blocks.
3. Indicators-only refresh repeatedly must keep non-technical fields unchanged.

## 8. Acceptance criteria

1. `/portfolio` shows all holdings and row click navigation works.
2. List page contains market key realtime news section below the table.
3. List page has portfolio-level realtime analysis and no batch realtime analysis button.
4. List table has no pending signal count column.
5. `/portfolio/position/:symbol` first screen is K line + indicators.
6. Indicators-only refresh does not alter non-technical fields.
