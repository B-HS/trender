from __future__ import annotations

import argparse
import asyncio
from typing import Literal

from trender.config import get_settings
from trender.fetch.browser import shutdown as shutdown_browser
from trender.logging import get_logger, setup_logging
from trender.pipeline.collect import collect_all
from trender.pipeline.evolve import evolve_sources
from trender.pipeline.report import generate_report
from trender.pipeline.summarize import summarize_pending
from trender.seeds.loader import sync_seeds

log = get_logger(__name__)

Task = Literal["seed", "collect", "summarize", "report", "evolve", "all"]


async def _run_task(task: Task, kind: str | None) -> None:
    if task == "seed":
        sync_seeds()
    elif task == "collect":
        await collect_all()
    elif task == "summarize":
        await summarize_pending()
    elif task == "report":
        await generate_report(kind or "daily")  # type: ignore[arg-type]
    elif task == "evolve":
        evolve_sources()
    elif task == "all":
        sync_seeds()
        await collect_all()
        await summarize_pending()
        await generate_report(kind or "daily")  # type: ignore[arg-type]
        evolve_sources()
    else:
        raise SystemExit(f"unknown task: {task}")


def cli() -> None:
    parser = argparse.ArgumentParser(prog="trender")
    parser.add_argument(
        "--task",
        required=True,
        choices=["seed", "collect", "summarize", "report", "evolve", "all"],
    )
    parser.add_argument("--kind", choices=["daily", "weekly", "monthly"], default=None)
    args = parser.parse_args()

    settings = get_settings()
    setup_logging(settings.log_level)
    log.info("trender.start", task=args.task, kind=args.kind)

    async def _runner() -> None:
        try:
            await _run_task(args.task, args.kind)
        finally:
            await shutdown_browser()

    try:
        asyncio.run(_runner())
        log.info("trender.done", task=args.task)
    except Exception as e:
        log.error("trender.failed", task=args.task, error=str(e))
        raise


if __name__ == "__main__":
    cli()
