from __future__ import annotations

import os
from datetime import datetime, timedelta
from pathlib import Path

from trender.logging import get_logger
from trender.pipeline.collect import collect_all
from trender.pipeline.extract_keywords import extract_pending
from trender.pipeline.report import backfill_reports
from trender.pipeline.translate import translate_pending

log = get_logger(__name__)

STATE_DIR = Path(os.environ.get("TRENDER_STATE_DIR", "/var/log/trender-state"))

COLLECT_STALE_AFTER = timedelta(minutes=65)
KEYWORDS_STALE_AFTER = timedelta(minutes=35)
TRANSLATE_STALE_AFTER = timedelta(minutes=40)
BACKFILL_DAILY_STALE_AFTER = timedelta(hours=6)
BACKFILL_WEEKLY_STALE_AFTER = timedelta(days=1)


def _state_path(task: str) -> Path:
    return STATE_DIR / f"{task}.last"


def mark_task_done(task: str, when: datetime | None = None) -> None:
    """task 가 성공적으로 끝났을 때 heartbeat 파일을 갱신한다."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    ts = (when or datetime.utcnow()).isoformat()
    _state_path(task).write_text(ts, encoding="utf-8")


def _last_run(task: str) -> datetime | None:
    p = _state_path(task)
    if not p.exists():
        return None
    try:
        return datetime.fromisoformat(p.read_text(encoding="utf-8").strip())
    except Exception:
        return None


def _is_stale(task: str, threshold: timedelta) -> bool:
    last = _last_run(task)
    if last is None:
        return True
    return (datetime.utcnow() - last) >= threshold


async def run_catchup(*, force: bool = False, keywords_limit: int = 120) -> dict[str, str]:
    """sleep/wake 후 누락된 작업을 따라잡는다.

    각 task 의 마지막 성공 시각을 보고 threshold 보다 오래 됐으면 실행한다.
    force=True 면 모든 task 를 무조건 실행한다.
    """
    actions: dict[str, str] = {}
    now = datetime.utcnow()

    if force or _is_stale("collect", COLLECT_STALE_AFTER):
        log.info("catchup.run", task="collect", last=str(_last_run("collect")))
        try:
            await collect_all()
            mark_task_done("collect", now)
            actions["collect"] = "ran"
        except Exception as e:
            log.warning("catchup.failed", task="collect", error=str(e))
            actions["collect"] = "failed"
    else:
        actions["collect"] = "fresh"

    if force or _is_stale("keywords", KEYWORDS_STALE_AFTER):
        log.info("catchup.run", task="keywords", last=str(_last_run("keywords")))
        try:
            await extract_pending(limit=keywords_limit)
            mark_task_done("keywords", now)
            actions["keywords"] = "ran"
        except Exception as e:
            log.warning("catchup.failed", task="keywords", error=str(e))
            actions["keywords"] = "failed"
    else:
        actions["keywords"] = "fresh"

    if force or _is_stale("translate", TRANSLATE_STALE_AFTER):
        log.info("catchup.run", task="translate", last=str(_last_run("translate")))
        try:
            await translate_pending(limit=keywords_limit)
            mark_task_done("translate", now)
            actions["translate"] = "ran"
        except Exception as e:
            log.warning("catchup.failed", task="translate", error=str(e))
            actions["translate"] = "failed"
    else:
        actions["translate"] = "fresh"

    if force or _is_stale("backfill_daily", BACKFILL_DAILY_STALE_AFTER):
        log.info("catchup.run", task="backfill_daily", last=str(_last_run("backfill_daily")))
        try:
            await backfill_reports("daily", days=3)
            mark_task_done("backfill_daily", now)
            actions["backfill_daily"] = "ran"
        except Exception as e:
            log.warning("catchup.failed", task="backfill_daily", error=str(e))
            actions["backfill_daily"] = "failed"
    else:
        actions["backfill_daily"] = "fresh"

    if force or _is_stale("backfill_weekly", BACKFILL_WEEKLY_STALE_AFTER):
        log.info("catchup.run", task="backfill_weekly", last=str(_last_run("backfill_weekly")))
        try:
            await backfill_reports("weekly", days=2)
            mark_task_done("backfill_weekly", now)
            actions["backfill_weekly"] = "ran"
        except Exception as e:
            log.warning("catchup.failed", task="backfill_weekly", error=str(e))
            actions["backfill_weekly"] = "failed"
    else:
        actions["backfill_weekly"] = "fresh"

    log.info("catchup.done", **actions)
    return actions
