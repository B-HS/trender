from __future__ import annotations

from datetime import datetime, timedelta

from trender.db.models import Source
from trender.db.repositories import (
    list_active_sources,
    stats_summary_for_source,
    update_source_stage,
)
from trender.logging import get_logger

log = get_logger(__name__)

PROMOTE_WINDOW_DAYS = 14
PROMOTE_MIN_HITS = 3
PROMOTE_MIN_ADOPTIONS = 1

DEMOTE_WINDOW_DAYS = 30
DEMOTE_MAX_ADOPTIONS = 0


def _evaluate(source: Source) -> str | None:
    """source 한 건의 다음 stage 결정. 결정 못 하면 None."""
    if source.id is None:
        return None
    if source.stage == "candidate":
        s = stats_summary_for_source(source.id, days=PROMOTE_WINDOW_DAYS)
        if s["hits"] >= PROMOTE_MIN_HITS and s["adoptions"] >= PROMOTE_MIN_ADOPTIONS:
            return "active"
        return None
    if source.stage == "active":
        anchor = source.promoted_at or source.created_at
        if anchor is None:
            return None
        if datetime.utcnow() - anchor < timedelta(days=DEMOTE_WINDOW_DAYS):
            return None
        s = stats_summary_for_source(source.id, days=DEMOTE_WINDOW_DAYS)
        if s["adoptions"] <= DEMOTE_MAX_ADOPTIONS:
            return "demoted"
        return None
    return None


def evolve_sources() -> dict[str, int]:
    """active/candidate web 소스의 stage 만 평가. 한 건 실패가 전체를 막지 않도록 방어."""
    promoted = demoted = failed = 0
    sources = list_active_sources()
    for source in sources:
        try:
            next_stage = _evaluate(source)
        except Exception as e:
            failed += 1
            log.warning("evolve.evaluate_failed", source_id=source.id, value=source.value, error=str(e))
            continue
        if next_stage is None or source.id is None:
            continue
        try:
            update_source_stage(source.id, next_stage)
        except Exception as e:
            failed += 1
            log.warning("evolve.update_failed", source_id=source.id, to=next_stage, error=str(e))
            continue
        log.info("evolve.stage_change", source_id=source.id, value=source.value, to=next_stage)
        if next_stage == "active":
            promoted += 1
        elif next_stage == "demoted":
            demoted += 1

    summary = {"evaluated": len(sources), "promoted": promoted, "demoted": demoted, "failed": failed}
    log.info("evolve.done", **summary)
    return summary
