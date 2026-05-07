# Shared DB Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a shared DB runtime with SQLite/MySQL backend selection, wire bootstrap into app startup, and migrate the quant/replay persistence path onto runtime-managed SQLite connections by default.

**Architecture:** Add a new `app/db` runtime layer for backend config, engine/connection registry, unit-of-work helpers, and bootstrap. Keep SQLite as the default execution path, add MySQL engine support behind configuration, and refactor quant/replay startup and gateway context to consume runtime-managed DB paths and connections without breaking the existing feature surface.

**Tech Stack:** Python, FastAPI, SQLAlchemy, Alembic, PyMySQL, pytest

---

### Task 1: Runtime Foundation

**Files:**
- Create: `app/db/__init__.py`
- Create: `app/db/runtime/__init__.py`
- Create: `app/db/runtime/config.py`
- Create: `app/db/runtime/types.py`
- Create: `app/db/runtime/engine_factory.py`
- Create: `app/db/runtime/registry.py`
- Create: `app/db/runtime/session.py`
- Create: `app/db/runtime/health.py`
- Modify: `requirements.txt`
- Test: `tests/test_db_runtime.py`

- [ ] Add failing tests for backend selection, SQLite default URLs, and invalid mixed backend configuration.
- [ ] Implement runtime config parsing and store URL derivation with `sqlite` default.
- [ ] Implement engine registry and backend-aware engine creation for SQLite and MySQL.
- [ ] Verify the new runtime tests pass.

### Task 2: Bootstrap and App Wiring

**Files:**
- Create: `app/db/bootstrap.py`
- Modify: `app/gateway_api.py`
- Modify: `app/gateway/context.py`
- Modify: `app/runtime_paths.py`
- Test: `tests/test_db_bootstrap.py`
- Test: `tests/test_ui_backend_api_contract.py`

- [ ] Add failing tests for bootstrap path creation and app startup initialization.
- [ ] Implement bootstrap entrypoints for runtime initialization and SQLite path preparation.
- [ ] Wire `create_app()` lifespan and `UIApiContext` to use a shared `DatabaseRuntime`.
- [ ] Verify bootstrap and API contract tests pass.

### Task 3: Quant/Replay Runtime Integration

**Files:**
- Modify: `app/quant_sim/db.py`
- Modify: `app/quant_sim/replay_runner.py`
- Modify: `app/quant_sim/replay_service.py`
- Modify: `app/gateway/his_replay.py`
- Test: `tests/test_quant_sim_db.py`
- Test: `tests/test_quant_sim_replay_runner.py`
- Test: `tests/test_ui_backend_api_actions.py`

- [ ] Add failing tests for runtime-managed SQLite connections and read-only replay GET behavior.
- [ ] Refactor quant/replay DB entrypoints to accept runtime-managed DB file resolution and connection policies.
- [ ] Stop replay GET paths from mutating replay state while answering reads.
- [ ] Verify quant/replay tests pass on the default SQLite backend.

### Task 4: Verification and Guardrails

**Files:**
- Modify: `tests/test_console_safety_audit.py`
- Create: `tests/test_sqlite_connect_guard.py`

- [ ] Add a regression check that flags new direct `sqlite3.connect(...)` calls outside explicitly grandfathered modules.
- [ ] Run the focused runtime/bootstrap/quant/replay test set.
- [ ] Record remaining migration work for non-quant DB modules without blocking the new runtime foundation.
