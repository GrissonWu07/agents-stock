# App Directory Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move business Python code under `app/` while keeping the current Streamlit startup flow and core functionality working through thin root entrypoints.

**Architecture:** Introduce a new top-level `app` package as the home for all business modules and existing business packages. Keep root `app.py` and `run.py` as compatibility shims so current launch commands still work, then update imports and tests in phases.

**Tech Stack:** Python 3.13, Streamlit, SQLite, pytest, PowerShell, git

---

## File Structure Map

### New package root
- Create: `app/__init__.py`
- Create: `app/app.py`
- Create: `app/run.py`

### Existing packages to move into `app/`
- Move: `quant_sim/` -> `app/quant_sim/`
- Move: `quant_kernel/` -> `app/quant_kernel/`

### Root modules to move into `app/`
- Move: `ai_agents.py`
- Move: `app.py` implementation body into `app/app.py`
- Move: `batch_deep_analysis.py`
- Move: `config.py`
- Move: `config_manager.py`
- Move: `console_utils.py`
- Move: `data_source_manager.py`
- Move: `database.py`
- Move: `deepseek_client.py`
- Move: `discovery_hub_ui.py`
- Move: `fund_flow_akshare.py`
- Move: `longhubang_*.py`
- Move: `low_price_bull_*.py`
- Move: `macro_analysis_*.py`
- Move: `macro_cycle_*.py`
- Move: `main_force_*.py`
- Move: `market_sentiment_data.py`
- Move: `miniqmt_interface.py`
- Move: `model_config.py`
- Move: `monitor_*.py`
- Move: `news_announcement_data.py`
- Move: `news_flow_*.py`
- Move: `notification_service.py`
- Move: `pdf_generator*.py`
- Move: `portfolio_*.py`
- Move: `profit_growth_*.py`
- Move: `pytdx_host_config.py`
- Move: `qstock_news_data.py`
- Move: `quarterly_report_data.py`
- Move: `research_hub_ui.py`
- Move: `research_watchlist_integration.py`
- Move: `risk_data_fetcher.py`
- Move: `sector_strategy_*.py`
- Move: `selector_result_store.py`
- Move: `selector_ui_state.py`
- Move: `sitecustomize.py`
- Move: `small_cap_*.py`
- Move: `smart_monitor_*.py`
- Move: `stm.py`
- Move: `stock_data.py`
- Move: `streamlit_flash.py`
- Move: `update_env_example.py`
- Move: `value_stock_*.py`
- Move: `watchlist_*.py`

### Root files to keep as thin shims
- Modify: `app.py`
- Modify: `run.py`

### Tests to update
- Modify: `tests/**/*.py` import paths as needed, starting with entrypoint and high-value workflow tests

### Docs to update later
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: docs that reference module paths directly

---

### Task 1: Create `app/` package skeleton and prove root shim pattern

**Files:**
- Create: `app/__init__.py`
- Create: `app/app.py`
- Create: `app/run.py`
- Modify: `app.py`
- Modify: `run.py`
- Test: `tests/test_root_entrypoint_shims.py`

- [ ] **Step 1: Write the failing test**

```python
from pathlib import Path
import importlib


def test_root_app_py_is_thin_shim_to_package_app():
    content = Path("app.py").read_text(encoding="utf-8")
    assert "from app.app import main" in content


def test_root_run_py_is_thin_shim_to_package_run():
    content = Path("run.py").read_text(encoding="utf-8")
    assert "from app.run import" in content


def test_package_app_module_imports():
    module = importlib.import_module("app.app")
    assert hasattr(module, "main")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_root_entrypoint_shims.py`
Expected: FAIL because `app/` package and thin shims do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```python
# app/__init__.py
"""Application package root for business code."""

# app/app.py
from importlib import import_module

_root_app = import_module("_root_app_impl")
main = _root_app.main

# app/run.py
from importlib import import_module

_root_run = import_module("_root_run_impl")
main = getattr(_root_run, "main", None)

# app.py
from app.app import main

if __name__ == "__main__":
    main()

# run.py
from app.run import main

if __name__ == "__main__" and main is not None:
    main()
```

- [ ] **Step 4: Move old root implementations behind temporary compatibility module names**

```powershell
Move-Item -LiteralPath app.py -Destination _root_app_impl.py
Move-Item -LiteralPath run.py -Destination _root_run_impl.py
```

Then recreate root `app.py` and `run.py` using the thin shim code above and create `app/app.py`, `app/run.py`, and `app/__init__.py`.

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest -q -p no:cacheprovider tests/test_root_entrypoint_shims.py`
Expected: PASS

- [ ] **Step 6: Run import verification**

Run: `python -c "import app; import app.app; import app.run; print('app-shims-ok')"`
Expected: `app-shims-ok`

- [ ] **Step 7: Commit**

```bash
git add app/__init__.py app/app.py app/run.py app.py run.py _root_app_impl.py _root_run_impl.py tests/test_root_entrypoint_shims.py
git commit -m "refactor: add app package entrypoint shims"
```

### Task 2: Move existing packages `quant_sim` and `quant_kernel` under `app/`

**Files:**
- Move: `quant_sim/` -> `app/quant_sim/`
- Move: `quant_kernel/` -> `app/quant_kernel/`
- Modify: all imports referencing `quant_sim` or `quant_kernel`
- Test: `tests/test_quant_sim_engine.py`
- Test: `tests/test_quant_replay_engine.py`
- Test: `tests/test_quant_kernel_runtime.py`

- [ ] **Step 1: Write the failing test**

```python
import importlib


def test_quant_packages_import_from_app_namespace():
    assert importlib.import_module("app.quant_sim.ui") is not None
    assert importlib.import_module("app.quant_kernel.runtime") is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_root_entrypoint_shims.py -k quant_packages_import_from_app_namespace`
Expected: FAIL because the packages are not yet under `app/`.

- [ ] **Step 3: Move the package directories**

Run:
```powershell
New-Item -ItemType Directory -Force -Path app | Out-Null
Move-Item -LiteralPath quant_sim -Destination app\quant_sim
Move-Item -LiteralPath quant_kernel -Destination app\quant_kernel
```

- [ ] **Step 4: Update imports to use `app.` package prefixes**

Examples to apply consistently:
```python
from app.quant_sim.ui import display_quant_sim
from app.quant_kernel.runtime import KernelStrategyRuntime
```

- [ ] **Step 5: Run targeted tests**

Run: `python -m pytest -q -p no:cacheprovider tests/test_quant_sim_engine.py tests/test_quant_replay_engine.py tests/test_quant_kernel_runtime.py`
Expected: PASS

- [ ] **Step 6: Run import verification**

Run: `python -c "import app.quant_sim.ui, app.quant_kernel.runtime; print('quant-packages-ok')"`
Expected: `quant-packages-ok`

- [ ] **Step 7: Commit**

```bash
git add app/quant_sim app/quant_kernel tests/test_root_entrypoint_shims.py
git commit -m "refactor: move quant packages under app"
```

### Task 3: Move core shared modules into `app/`

**Files:**
- Move: `ai_agents.py`, `stock_data.py`, `data_source_manager.py`, `deepseek_client.py`, `notification_service.py`, `watchlist_db.py`, `watchlist_service.py`, `streamlit_flash.py`, `config.py`, `config_manager.py`, `database.py`, `model_config.py`, `console_utils.py`, `pytdx_host_config.py`
- Modify: imports across moved files and consumers
- Test: `tests/test_app_stock_fetch.py`
- Test: `tests/test_watchlist_service.py`
- Test: `tests/test_streamlit_flash.py`

- [ ] **Step 1: Write the failing test**

```python
import importlib


def test_core_modules_import_from_app_namespace():
    assert importlib.import_module("app.stock_data") is not None
    assert importlib.import_module("app.watchlist_service") is not None
    assert importlib.import_module("app.ai_agents") is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_root_entrypoint_shims.py -k core_modules_import_from_app_namespace`
Expected: FAIL

- [ ] **Step 3: Move the modules into `app/`**

Run:
```powershell
Move-Item -LiteralPath ai_agents.py -Destination app\ai_agents.py
Move-Item -LiteralPath stock_data.py -Destination app\stock_data.py
Move-Item -LiteralPath data_source_manager.py -Destination app\data_source_manager.py
Move-Item -LiteralPath deepseek_client.py -Destination app\deepseek_client.py
Move-Item -LiteralPath notification_service.py -Destination app\notification_service.py
Move-Item -LiteralPath watchlist_db.py -Destination app\watchlist_db.py
Move-Item -LiteralPath watchlist_service.py -Destination app\watchlist_service.py
Move-Item -LiteralPath streamlit_flash.py -Destination app\streamlit_flash.py
Move-Item -LiteralPath config.py -Destination app\config.py
Move-Item -LiteralPath config_manager.py -Destination app\config_manager.py
Move-Item -LiteralPath database.py -Destination app\database.py
Move-Item -LiteralPath model_config.py -Destination app\model_config.py
Move-Item -LiteralPath console_utils.py -Destination app\console_utils.py
Move-Item -LiteralPath pytdx_host_config.py -Destination app\pytdx_host_config.py
```

- [ ] **Step 4: Update imports in moved files and consumers**

Examples:
```python
from app.data_source_manager import DataSourceManager
from app.watchlist_db import WatchlistDB
from app.config import DEEPSEEK_API_KEY
```

- [ ] **Step 5: Run targeted tests**

Run: `python -m pytest -q -p no:cacheprovider tests/test_app_stock_fetch.py tests/test_watchlist_service.py tests/test_streamlit_flash.py`
Expected: PASS

- [ ] **Step 6: Run import verification**

Run: `python -c "import app.stock_data, app.watchlist_service, app.ai_agents; print('core-modules-ok')"`
Expected: `core-modules-ok`

- [ ] **Step 7: Commit**

```bash
git add app/ai_agents.py app/stock_data.py app/data_source_manager.py app/deepseek_client.py app/notification_service.py app/watchlist_db.py app/watchlist_service.py app/streamlit_flash.py app/config.py app/config_manager.py app/database.py app/model_config.py app/console_utils.py app/pytdx_host_config.py
git commit -m "refactor: move shared business modules under app"
```

### Task 4: Move workbench, discovery, and research modules under `app/`

**Files:**
- Move: `watchlist_ui.py`, `discovery_hub_ui.py`, `research_hub_ui.py`, `watchlist_selector_integration.py`, `research_watchlist_integration.py`, selector/result helper files
- Move: discovery and research strategy modules (`main_force_*.py`, `low_price_bull_*.py`, `small_cap_*.py`, `profit_growth_*.py`, `value_stock_*.py`, `sector_strategy_*.py`, `longhubang_*.py`, `news_flow_*.py`, `macro_analysis_*.py`, `macro_cycle_*.py`)
- Test: `tests/test_discovery_hub_ui.py`
- Test: `tests/test_research_hub_ui.py`
- Test: `tests/test_watchlist_workbench.py`
- Test: `tests/test_watchlist_selector_integration.py`
- Test: `tests/test_research_watchlist_integration.py`

- [ ] **Step 1: Write the failing import test**

```python
import importlib


def test_ui_and_hub_modules_import_from_app_namespace():
    assert importlib.import_module("app.watchlist_ui") is not None
    assert importlib.import_module("app.discovery_hub_ui") is not None
    assert importlib.import_module("app.research_hub_ui") is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_root_entrypoint_shims.py -k ui_and_hub_modules_import_from_app_namespace`
Expected: FAIL

- [ ] **Step 3: Move the modules into `app/`**

Use PowerShell `Move-Item` for the listed files and preserve filenames under `app/`.

- [ ] **Step 4: Update imports in `app/app.py` and all moved modules**

Examples:
```python
from app.watchlist_ui import display_watchlist_workbench
from app.discovery_hub_ui import display_discovery_hub
from app.main_force_ui import display_main_force_selector
```

- [ ] **Step 5: Run targeted tests**

Run: `python -m pytest -q -p no:cacheprovider tests/test_discovery_hub_ui.py tests/test_research_hub_ui.py tests/test_watchlist_workbench.py tests/test_watchlist_selector_integration.py tests/test_research_watchlist_integration.py`
Expected: PASS

- [ ] **Step 6: Run import verification**

Run: `python -c "import app.watchlist_ui, app.discovery_hub_ui, app.research_hub_ui; print('ui-hubs-ok')"`
Expected: `ui-hubs-ok`

- [ ] **Step 7: Commit**

```bash
git add app/watchlist_ui.py app/discovery_hub_ui.py app/research_hub_ui.py app/watchlist_selector_integration.py app/research_watchlist_integration.py app/main_force_*.py app/low_price_bull_*.py app/small_cap_*.py app/profit_growth_*.py app/value_stock_*.py app/sector_strategy_*.py app/longhubang_*.py app/news_flow_*.py app/macro_analysis_*.py app/macro_cycle_*.py
git commit -m "refactor: move workbench discovery and research modules under app"
```

### Task 5: Move portfolio and monitoring modules under `app/`

**Files:**
- Move: `portfolio_*.py`, `monitor_*.py`, `smart_monitor_*.py`, `miniqmt_interface.py`, `news_announcement_data.py`, `qstock_news_data.py`, `risk_data_fetcher.py`, `quarterly_report_data.py`, `fund_flow_akshare.py`, `sitecustomize.py`, `stm.py`, `batch_deep_analysis.py`, `update_env_example.py`, `pdf_generator*.py`
- Test: `tests/test_portfolio_*` (if present via pattern)
- Test: `tests/test_smart_monitor_tdx_data.py`
- Test: `tests/test_data_source_manager.py`

- [ ] **Step 1: Write the failing import test**

```python
import importlib


def test_portfolio_and_monitor_modules_import_from_app_namespace():
    assert importlib.import_module("app.portfolio_ui") is not None
    assert importlib.import_module("app.monitor_manager") is not None
    assert importlib.import_module("app.smart_monitor_ui") is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_root_entrypoint_shims.py -k portfolio_and_monitor_modules_import_from_app_namespace`
Expected: FAIL

- [ ] **Step 3: Move the modules into `app/` and update imports**

Use `Move-Item` for the listed files and replace root imports with `app.` imports.

- [ ] **Step 4: Run targeted tests**

Run: `python -m pytest -q -p no:cacheprovider tests/test_smart_monitor_tdx_data.py tests/test_data_source_manager.py`
Expected: PASS

- [ ] **Step 5: Run import verification**

Run: `python -c "import app.portfolio_ui, app.monitor_manager, app.smart_monitor_ui; print('monitor-stack-ok')"`
Expected: `monitor-stack-ok`

- [ ] **Step 6: Commit**

```bash
git add app/portfolio_*.py app/monitor_*.py app/smart_monitor_*.py app/miniqmt_interface.py app/news_announcement_data.py app/qstock_news_data.py app/risk_data_fetcher.py app/quarterly_report_data.py app/fund_flow_akshare.py app/sitecustomize.py app/stm.py app/batch_deep_analysis.py app/update_env_example.py app/pdf_generator*.py
git commit -m "refactor: move portfolio and monitor modules under app"
```

### Task 6: Remove temporary `_root_*` compatibility implementation modules by making `app/` the real home

**Files:**
- Modify: `app/app.py`
- Modify: `app/run.py`
- Remove: `_root_app_impl.py`
- Remove: `_root_run_impl.py`
- Modify: `app.py`
- Modify: `run.py`
- Test: `tests/test_root_entrypoint_shims.py`

- [ ] **Step 1: Write the failing test**

```python
from pathlib import Path


def test_root_temp_impl_modules_are_gone_after_migration():
    assert not Path("_root_app_impl.py").exists()
    assert not Path("_root_run_impl.py").exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_root_entrypoint_shims.py -k root_temp_impl_modules_are_gone_after_migration`
Expected: FAIL

- [ ] **Step 3: Move actual implementation into `app/app.py` and `app/run.py`**

Replace temporary import-forwarders with the full implementation content, then remove `_root_app_impl.py` and `_root_run_impl.py`.

- [ ] **Step 4: Keep root shims thin**

Ensure:
```python
# app.py
from app.app import main

if __name__ == "__main__":
    main()
```

```python
# run.py
from app.run import main

if __name__ == "__main__" and main is not None:
    main()
```

- [ ] **Step 5: Run entrypoint tests and imports**

Run: `python -m pytest -q -p no:cacheprovider tests/test_root_entrypoint_shims.py`
Expected: PASS

Run: `python -c "import app; import app.app; print('final-entrypoints-ok')"`
Expected: `final-entrypoints-ok`

- [ ] **Step 6: Commit**

```bash
git add app/app.py app/run.py app.py run.py tests/test_root_entrypoint_shims.py
git rm _root_app_impl.py _root_run_impl.py
git commit -m "refactor: finalize app package entrypoints"
```

### Task 7: Update tests and docs for the new package layout

**Files:**
- Modify: affected `tests/**/*.py`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: docs that reference root module paths directly

- [ ] **Step 1: Write the failing test**

```python
import importlib


def test_common_top_level_imports_use_app_namespace():
    assert importlib.import_module("app.watchlist_ui") is not None
    assert importlib.import_module("app.quant_sim.ui") is not None
    assert importlib.import_module("app.discovery_hub_ui") is not None
```

- [ ] **Step 2: Run test to verify it fails where imports remain stale**

Run: `python -m pytest -q -p no:cacheprovider tests/test_root_entrypoint_shims.py -k common_top_level_imports_use_app_namespace`
Expected: FAIL if any stale imports remain.

- [ ] **Step 3: Update tests and docs**

Examples:
```python
from app.watchlist_ui import display_watchlist_workbench
from app.quant_sim.ui import display_quant_sim
```

Update docs so file references point to `app/...` for moved code.

- [ ] **Step 4: Run focused workflow regression suite**

Run: `python -m pytest -q -p no:cacheprovider tests/test_watchlist_workflow_e2e.py tests/test_watchlist_quant_bridge.py tests/test_quant_sim_auto_execution.py tests/test_quant_continuous_simulation.py tests/test_discovery_hub_ui.py tests/test_research_hub_ui.py tests/test_main_force_candidate_table.py`
Expected: PASS

- [ ] **Step 5: Run whole-project import and compile verification**

Run: `python -m compileall app app.py run.py`
Expected: exit 0

Run: `python -c "import app; import app.app; import app.watchlist_ui; import app.quant_sim.ui; print('migration-ok')"`
Expected: `migration-ok`

- [ ] **Step 6: Commit**

```bash
git add tests README.md docs/README.md app.py run.py app
git commit -m "refactor: update tests and docs for app package layout"
```
