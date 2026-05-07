from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest


E2E_DIR = Path(__file__).resolve().parent


@pytest.mark.e2e_ui
def test_frontend_browser_e2e_suite_runs():
    """Run the Playwright browser suite from pytest when explicitly enabled."""

    if os.environ.get("E2E_UI_ENABLE", "").strip() != "1":
        pytest.skip("Set E2E_UI_ENABLE=1 to run browser UI e2e tests.")

    npm = shutil.which("npm")
    npx = shutil.which("npx")
    if not npm or not npx:
        pytest.skip("npm/npx is required for browser UI e2e tests.")

    if not (E2E_DIR / "node_modules").exists():
        subprocess.run([npm, "install"], cwd=E2E_DIR, check=True)

    subprocess.run([npx, "playwright", "install", "chromium"], cwd=E2E_DIR, check=True)
    subprocess.run([npx, "playwright", "test"], cwd=E2E_DIR, check=True)
