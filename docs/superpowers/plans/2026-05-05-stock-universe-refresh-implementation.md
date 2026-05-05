# Stock Universe Refresh Implementation Plan

## Goal

Implement the first deployment slice of `2026-05-05-stock-universe-refresh-architecture-design.md`:

1. Use `stock_universe` as the only physical stock pool.
2. Represent watch, realtime quant, and registered holding membership as tags/profile fields on `stock_universe`.
3. Remove old watchlist DB and registered holding DB entry points from runtime code.
4. Stop old watchlist quote refresh paths; keep refresh responsibility in the unified stock refresh scheduler.
5. Add a deployment reset script for old DB cleanup.

## Steps

1. Add `stock_universe` and `stock_universe_sources` storage in `QuantSimDB`.
2. Rewire watchlist and candidate service operations to read/write `stock_universe`.
3. Rewire registered holdings to `stock_universe` and keep analysis history in the live quant DB.
4. Remove `WatchlistDB`, old runtime DB registration, and old watchlist refresh entry points.
5. Update realtime simulation, replay, workbench, discovery, research, settings, and portfolio gateways to use the unified DB path.
6. Update UI wording from “量化候选池/量化池” to “实时量化股票/回放股票范围”.
7. Add `scripts/reset_stock_universe_deployment.py --yes`.
8. Update tests and run backend/frontend verification.
