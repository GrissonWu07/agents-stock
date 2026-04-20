from __future__ import annotations

from typing import Any, Callable

from app.async_task_base import AsyncTaskManagerBase
from app.i18n import t


class PortfolioRebalanceTaskManager(AsyncTaskManagerBase):
    def __init__(self, *, limit: int = 120) -> None:
        super().__init__(task_prefix="portfolio-rebalance", title=t("Portfolio rebalance task"), limit=limit)

    def create_task(
        self,
        *,
        mode: str,
        cycle: str,
        max_workers: int,
        now: Callable[[], str],
    ) -> str:
        return super().create_task(
            now=now,
            message=t("Portfolio rebalance task submitted"),
            stage="queued",
            progress=0,
            mode=mode,
            cycle=cycle,
            max_workers=max_workers,
            logs=[],
            result=None,
            errors=[],
        )

    def _append_log(self, task: dict[str, Any] | None, *, now: Callable[[], str], stage: str, message: str) -> list[dict[str, str]]:
        rows: list[dict[str, str]] = []
        if isinstance(task, dict) and isinstance(task.get("logs"), list):
            rows = [item for item in task.get("logs") if isinstance(item, dict)][-49:]
        rows.append({"time": now(), "stage": stage, "message": message})
        return rows

    def run_task(
        self,
        *,
        task_id: str,
        context: Any,
        now: Callable[[], str],
        txt: Callable[[Any, str], str],
    ) -> None:
        task = self.get_task(task_id)
        if not task:
            return
        mode = txt(task.get("mode"), "parallel")
        cycle = txt(task.get("cycle"), "1y")
        max_workers = int(task.get("max_workers") or 3)
        try:
            logs = self._append_log(task, now=now, stage="start", message=t("Start portfolio-level analysis"))
            self.update_task(
                task_id,
                now=now,
                status="running",
                stage="running",
                progress=10,
                started_at=now(),
                message=t("Portfolio-level analysis is running"),
                logs=logs,
            )
            manager = context.portfolio_manager()
            analysis_results = manager.batch_analyze_portfolio(mode=mode, period=cycle, max_workers=max_workers)
            if not analysis_results.get("success"):
                logs = self._append_log(
                    self.get_task(task_id),
                    now=now,
                    stage="failed",
                    message=txt(analysis_results.get("error"), t("Portfolio-level analysis failed")),
                )
                self.update_task(
                    task_id,
                    now=now,
                    status="failed",
                    stage="failed",
                    progress=100,
                    message=txt(analysis_results.get("error"), t("Portfolio-level analysis failed")),
                    logs=logs,
                    errors=[{"message": txt(analysis_results.get("error"), t("Unknown error"))}],
                    finished_at=now(),
                )
                return

            logs = self._append_log(
                self.get_task(task_id),
                now=now,
                stage="persist",
                message=t("Persisting portfolio analysis result"),
            )
            self.update_task(
                task_id,
                now=now,
                status="running",
                stage="persist",
                progress=75,
                message=t("Persisting analysis result"),
                logs=logs,
            )
            saved_ids = manager.save_analysis_results(analysis_results)
            results = analysis_results.get("results") if isinstance(analysis_results.get("results"), list) else []
            logs = self._append_log(
                self.get_task(task_id),
                now=now,
                stage="completed",
                message=t("Portfolio-level analysis completed"),
            )
            self.update_task(
                task_id,
                now=now,
                status="completed",
                stage="completed",
                progress=100,
                message=t("Portfolio-level analysis completed: {count} symbols", count=len(results)),
                logs=logs,
                result={"savedCount": len(saved_ids), "resultCount": len(results)},
                results=results,
                finished_at=now(),
            )
        except Exception as exc:
            logs = self._append_log(self.get_task(task_id), now=now, stage="failed", message=str(exc))
            self.update_task(
                task_id,
                now=now,
                status="failed",
                stage="failed",
                progress=100,
                message=t("Portfolio-level analysis failed"),
                logs=logs,
                errors=[{"message": str(exc)}],
                finished_at=now(),
            )


portfolio_rebalance_task_manager = PortfolioRebalanceTaskManager()


__all__ = ["PortfolioRebalanceTaskManager", "portfolio_rebalance_task_manager"]
