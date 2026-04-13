from pathlib import Path
import importlib


def test_root_app_py_is_thin_shim_to_package_app():
    content = Path("app.py").read_text(encoding="utf-8")
    assert "from app.app import main" in content


def test_root_run_py_is_thin_shim_to_package_run():
    content = Path("run.py").read_text(encoding="utf-8")
    assert "from app.run import main" in content


def test_package_app_module_imports():
    module = importlib.import_module("app.app")
    assert hasattr(module, "main")


def test_quant_packages_import_from_app_namespace():
    assert importlib.import_module("app.quant_sim.ui") is not None
    assert importlib.import_module("app.quant_kernel.runtime") is not None


def test_core_modules_import_from_app_namespace():
    assert importlib.import_module("app.stock_data") is not None
    assert importlib.import_module("app.watchlist_service") is not None
    assert importlib.import_module("app.ai_agents") is not None


def test_ui_and_hub_modules_import_from_app_namespace():
    assert importlib.import_module("app.watchlist_ui") is not None
    assert importlib.import_module("app.discovery_hub_ui") is not None
    assert importlib.import_module("app.research_hub_ui") is not None


def test_portfolio_and_monitor_modules_import_from_app_namespace():
    assert importlib.import_module("app.portfolio_ui") is not None
    assert importlib.import_module("app.monitor_manager") is not None
    assert importlib.import_module("app.smart_monitor_ui") is not None
