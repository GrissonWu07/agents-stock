from __future__ import annotations

from pathlib import Path
from typing import Any

from app.db.runtime.registry import DatabaseRuntime
from app.quant_sim.db import DEFAULT_DB_FILE


DEFAULT_STOCK_UNIVERSE_DB_FILE = DEFAULT_DB_FILE


class WatchlistService:
    """Stock-universe operations for watched stocks.

    The physical store is ``stock_universe`` in the live quant database. Watch,
    realtime quant, and registered holding membership are tags on that row.
    """

    def __init__(
        self,
        db_file: str | Path = DEFAULT_STOCK_UNIVERSE_DB_FILE,
        *,
        db_runtime: DatabaseRuntime | None = None,
    ):
        from app.quant_sim.db import QuantSimDB

        self.db = QuantSimDB(db_file, db_runtime=db_runtime)

    def add_stock(
        self,
        stock_code: str,
        stock_name: str,
        source: str,
        latest_price: float | None = None,
        notes: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        watch_id = self.db.add_watch(
            stock_code=stock_code,
            stock_name=stock_name,
            source=source,
            latest_price=latest_price,
            notes=notes,
            metadata=metadata,
        )
        return {"created": True, "watch_id": watch_id}

    def add_manual_stock(self, stock_code: str) -> dict[str, Any]:
        normalized_code = str(stock_code).strip().upper()
        if not normalized_code:
            raise ValueError("Invalid stock code")
        existing = self.get_watch(normalized_code)
        if existing:
            return {
                "created": False,
                "stock_name": str(existing.get("stock_name") or normalized_code),
                "watch_id": existing.get("id"),
            }
        summary = self.add_stock(
            stock_code=normalized_code,
            stock_name=normalized_code,
            source="manual",
            latest_price=None,
            metadata={"basic_info_missing": True},
        )
        summary["stock_name"] = normalized_code
        return summary

    def add_many(self, rows: list[dict[str, Any]]) -> dict[str, Any]:
        summary: dict[str, Any] = {"attempted": 0, "success_count": 0, "failures": []}
        for row in rows:
            stock_code = str(row.get("stock_code", "")).strip()
            stock_name = str(row.get("stock_name", "")).strip()
            source = str(row.get("source", "")).strip()
            if not stock_code or not stock_name or not source:
                summary["failures"].append(f"{stock_code or 'UNKNOWN'}: missing required field")
                continue

            summary["attempted"] += 1
            self.add_stock(
                stock_code=stock_code,
                stock_name=stock_name,
                source=source,
                latest_price=row.get("latest_price"),
                notes=row.get("notes"),
                metadata=row.get("metadata"),
            )
            summary["success_count"] += 1
        return summary

    def list_watches(self) -> list[dict[str, Any]]:
        return self.db.list_watches()

    def list_watches_page(self, search: str | None = None, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        return self.db.list_watches_page(search=search, limit=limit, offset=offset)

    def count_watches(self, search: str | None = None, *, in_quant_pool: bool | None = None) -> int:
        return self.db.count_watches(search=search, in_quant_pool=in_quant_pool)

    def list_stock_universe_page(self, search: str | None = None, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        return self.db.list_stock_universe_page(search=search, limit=limit, offset=offset)

    def count_stock_universe(self, search: str | None = None) -> int:
        return self.db.count_stock_universe(search=search)

    def get_watch(self, stock_code: str) -> dict[str, Any] | None:
        return self.db.get_watch(stock_code)

    def mark_in_quant_pool(self, stock_code: str, in_quant_pool: bool) -> None:
        self.db.update_quant_membership(stock_code, in_quant_pool)

    def sync_quant_membership(self, candidate_stock_codes: list[str]) -> None:
        normalized_codes = {str(stock_code).strip().upper() for stock_code in candidate_stock_codes}
        for watch in self.list_watches():
            self.mark_in_quant_pool(watch["stock_code"], watch["stock_code"] in normalized_codes)

    def update_watch_snapshot(
        self,
        stock_code: str,
        *,
        latest_signal: str | None = None,
        latest_price: float | None = None,
        stock_name: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.db.update_watch_snapshot(
            stock_code,
            latest_signal=latest_signal,
            latest_price=latest_price,
            stock_name=stock_name,
            metadata=metadata,
        )

    def delete_stock(self, stock_code: str) -> None:
        self.db.delete_watch(stock_code)
