from app.watchlist_service import WatchlistService
from app.quant_sim.candidate_pool_service import CandidatePoolService


def test_watchlist_service_add_from_selector_row(tmp_path):
    service = WatchlistService(db_file=tmp_path / "quant_sim.db")

    summary = service.add_stock(
        stock_code="002824",
        stock_name="和胜股份",
        source="main_force",
        latest_price=22.97,
        notes="来自主力选股",
        metadata={"industry": "消费电子"},
    )

    assert summary["created"] is True
    assert summary["watch_id"] > 0
    assert service.get_watch("002824")["stock_name"] == "和胜股份"


def test_watchlist_service_batch_add_returns_attempt_summary(tmp_path):
    service = WatchlistService(db_file=tmp_path / "quant_sim.db")

    result = service.add_many(
        [
            {"stock_code": "002824", "stock_name": "和胜股份", "source": "main_force"},
            {"stock_code": "301291", "stock_name": "明阳电气", "source": "main_force"},
        ]
    )

    assert result["attempted"] == 2
    assert result["success_count"] == 2
    assert result["failures"] == []


def test_watchlist_service_add_manual_stock_marks_basic_info_missing(tmp_path):
    service = WatchlistService(db_file=tmp_path / "quant_sim.db")

    summary = service.add_manual_stock("300390")
    watch = service.get_watch("300390")
    conn = service.db._connect()
    row = conn.execute("SELECT basic_info_missing FROM stock_universe WHERE stock_code = ?", ("300390",)).fetchone()
    conn.close()

    assert summary["created"] is True
    assert summary["watch_id"] > 0
    assert summary["stock_name"] == "300390"
    assert watch["stock_name"] == "300390"
    assert watch["source_summary"] == "manual"
    assert watch["metadata"]["basic_info_missing"] is True
    assert row["basic_info_missing"] == 1


def test_watchlist_service_quant_membership_uses_stock_universe(tmp_path):
    db_file = tmp_path / "quant_sim.db"
    service = WatchlistService(db_file=db_file)

    service.add_manual_stock("300390")
    service.mark_in_quant_pool("300390", True)
    watch = service.get_watch("300390")

    assert watch["in_quant_pool"] is True
    assert CandidatePoolService(db_file=db_file).count_candidates(status="active") == 1


def test_watchlist_service_delete_only_clears_watch_tag(tmp_path):
    db_file = tmp_path / "quant_sim.db"
    service = WatchlistService(db_file=db_file)

    service.add_stock(stock_code="600519", stock_name="贵州茅台", source="manual")
    service.mark_in_quant_pool("600519", True)
    service.delete_stock("600519")

    assert service.get_watch("600519") is None
    assert CandidatePoolService(db_file=db_file).count_candidates(status="active") == 1


def test_stock_universe_page_includes_quant_only_stocks(tmp_path):
    db_file = tmp_path / "quant_sim.db"
    service = WatchlistService(db_file=db_file)

    service.add_stock(stock_code="600519", stock_name="贵州茅台", source="manual")
    CandidatePoolService(db_file=db_file).add_candidate(
        stock_code="301217",
        stock_name="和顺电气",
        source="selector",
    )

    rows = {row["stock_code"]: row for row in service.list_stock_universe_page(limit=50)}

    assert service.count_stock_universe() == 2
    assert rows["600519"]["watched"] is True
    assert rows["301217"]["in_quant_pool"] is True
    assert rows["301217"]["watched"] is False
