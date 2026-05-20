from __future__ import annotations

import argparse
import asyncio
from typing import Literal, get_args

from trender.config import get_settings
from trender.db.models import Lang, ReportKind
from trender.fetch.browser import shutdown as shutdown_browser
from trender.logging import get_logger, setup_logging
from trender.pipeline.collect import collect_all
from trender.pipeline.evolve import evolve_sources
from trender.pipeline.extract_keywords import extract_pending
from trender.pipeline.report import backfill_reports, generate_all_languages, generate_report
from trender.seeds.loader import sync_seeds

log = get_logger(__name__)

Task = Literal["seed", "collect", "keywords", "report", "backfill", "evolve", "all"]


async def _run_report(kind: ReportKind, lang: Lang | None) -> None:
    if lang is None:
        await generate_all_languages(kind)
    else:
        await generate_report(kind, lang)


async def _run_backfill(kind: str, days: int) -> None:
    kinds: tuple[ReportKind, ...] = ("daily", "weekly") if kind == "all" else (kind,)  # type: ignore[assignment]
    for k in kinds:
        await backfill_reports(k, days=days)


async def _run_task(task: Task, kind: str, lang: Lang | None, limit: int, days: int) -> None:
    if task == "seed":
        sync_seeds()
    elif task == "collect":
        await collect_all()
    elif task == "keywords":
        await extract_pending(limit=limit)
    elif task == "report":
        await _run_report(kind, lang)  # type: ignore[arg-type]
    elif task == "backfill":
        await _run_backfill(kind, days=days)
    elif task == "evolve":
        evolve_sources()
    elif task == "all":
        sync_seeds()
        await collect_all()
        await extract_pending(limit=limit)
        await _run_report(kind, lang)
        evolve_sources()
    else:
        raise SystemExit(f"unknown task: {task}")


def cli() -> None:
    parser = argparse.ArgumentParser(prog="trender")
    parser.add_argument(
        "--task",
        required=True,
        choices=["seed", "collect", "keywords", "report", "backfill", "evolve", "all"],
    )
    parser.add_argument(
        "--kind",
        choices=[*get_args(ReportKind), "all"],
        default="daily",
        help="report/backfill 작업의 종류. backfill 에서 'all' 지정 시 daily/weekly 모두 채움",
    )
    parser.add_argument(
        "--lang",
        choices=list(get_args(Lang)),
        default=None,
        help="report 작업에서 단일 언어만 생성하고 싶을 때 지정. 미지정 시 ko/ja/en 모두 생성",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=60,
        help="keywords 작업에서 한 번에 처리할 기사 수 (기본 60)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=14,
        help="backfill 작업에서 거슬러 올라갈 기간. daily 면 일수, weekly 면 주수 (기본 14)",
    )
    args = parser.parse_args()

    settings = get_settings()
    setup_logging(settings.log_level)
    log.info("trender.start", task=args.task, kind=args.kind, lang=args.lang)

    async def _runner() -> None:
        try:
            await _run_task(args.task, args.kind, args.lang, args.limit, args.days)
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
