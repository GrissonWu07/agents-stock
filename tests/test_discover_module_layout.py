from __future__ import annotations

from pathlib import Path


def test_discover_business_modules_live_under_discover_package():
    root = Path(__file__).resolve().parents[1]

    assert (root / "app" / "discover" / "gateway.py").exists()
    assert (root / "app" / "discover" / "ai_stock_scanner.py").exists()
    assert not (root / "app" / "gateway" / "discover.py").exists()
    assert not (root / "app" / "ai_stock_scanner.py").exists()
