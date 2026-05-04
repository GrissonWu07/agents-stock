# Quant Replay DB Isolation Design

## Goal

Separate historical replay persistence from live quant simulation persistence.

`quant_sim.db` remains the live/shared database for candidate pool, strategy configuration, live positions, live trades, live account, live capital slots, and live strategy signals. Historical replay writes and reads only `quant_sim_replay.db`.

## Explicit Non-Goals

- No migration from existing `quant_sim.db.sim_run_*` tables.
- No compatibility fallback that reads old replay data from `quant_sim.db`.
- No automatic cleanup of old `sim_run_*` tables in `quant_sim.db`.
- No live-sim state reset in application startup.

Deployment to `family-mac` will reset the quant databases manually, so the new replay database starts clean.

## Database Boundaries

### `quant_sim.db`

Owns:

- `candidate_pool`
- `candidate_sources`
- `strategy_profiles`
- `strategy_profile_versions`
- `sim_scheduler_config`
- `strategy_signals`
- `sim_positions`
- `sim_position_lots`
- `sim_account`
- `sim_account_snapshots`
- `sim_trades`
- `sim_capital_slots`
- `sim_lot_slot_allocations`
- `sim_corporate_action_applications`

The existing `sim_run_*` tables may remain in old physical files but new code must not create, write, or read them from the live DB.

### `quant_sim_replay.db`

Owns:

- `sim_runs`
- `sim_run_checkpoints`
- `sim_run_events`
- `sim_run_trades`
- `sim_run_snapshots`
- `sim_run_positions`
- `sim_run_signals`
- `sim_run_signal_details`

`sim_run_signals` stores list/detail summary fields only. Large structured explanation payloads are stored in `sim_run_signal_details` and loaded only when a replay signal detail is requested.

## Signal Table Contract

Live and replay signals use different physical tables but keep the same public summary fields:

- `id`
- `stock_code`
- `stock_name`
- `action`
- `confidence`
- `reasoning`
- `position_size_pct`
- `stop_loss_pct`
- `take_profit_pct`
- `decision_type`
- `tech_score`
- `context_score`
- `status`
- `created_at`
- `updated_at`

Replay signals additionally include:

- `run_id`
- `source_signal_id`
- `checkpoint_at`

Replay signal detail loads `strategy_profile_json` from `sim_run_signal_details`.

## Runtime Flow

Historical replay service receives two DB paths:

- live/shared DB path for candidate pool, strategy profile snapshots, and scheduler config.
- replay DB path for run status, checkpoints, replay trades, replay snapshots, replay positions, replay signals, and replay events.

The temporary execution DB remains separate and is used only inside a replay worker.

## Gateway Flow

- `/api/v1/quant/live-sim*` reads `context.quant_db()`.
- `/api/v1/quant/his-replay*` reads `context.replay_db()`.
- `/api/v1/quant/signals/{id}?source=replay` reads replay DB for the replay signal and live/shared DB only for shared strategy settings if needed.
- `/api/v1/quant/signals/{id}?source=live` reads live/shared DB.

## Deployment Reset

On `family-mac`, stop services, delete or archive:

- `/Users/grisson.wu/app/xuanwustock/data/quant_sim.db`
- `/Users/grisson.wu/app/xuanwustock/data/quant_sim.db-wal`
- `/Users/grisson.wu/app/xuanwustock/data/quant_sim.db-shm`
- `/Users/grisson.wu/app/xuanwustock/data/quant_sim_replay.db`
- `/Users/grisson.wu/app/xuanwustock/data/quant_sim_replay.db-wal`
- `/Users/grisson.wu/app/xuanwustock/data/quant_sim_replay.db-shm`

Then redeploy. The application recreates both schemas from scratch.

## Acceptance Criteria

- `QuantSimDB` no longer creates replay-owned `sim_run_*` tables.
- `QuantSimReplayDB` creates and owns replay tables.
- Starting a historical replay creates rows in `quant_sim_replay.db`, not `quant_sim.db`.
- Live-sim snapshots and tables still use `quant_sim.db`.
- Historical replay APIs read only `quant_sim_replay.db` for run/trade/signal/checkpoint artifacts.
- Replay signal list rows do not include full `strategy_profile_json`.
- Replay signal detail loads full strategy/explainability JSON from `sim_run_signal_details`.
