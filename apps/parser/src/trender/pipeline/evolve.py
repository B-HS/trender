from __future__ import annotations

from datetime import datetime, timedelta
from typing import get_args

from trender.db.models import Lang, Source
from trender.db.repositories import (
    candidate_keyword_frequencies,
    list_active_sources,
    stats_summary_for_source,
    update_source_stage,
    upsert_source,
)
from trender.logging import get_logger

log = get_logger(__name__)

PROMOTE_WINDOW_DAYS = 14
PROMOTE_MIN_HITS = 3
PROMOTE_MIN_ADOPTIONS = 1

DEMOTE_WINDOW_DAYS = 30
DEMOTE_MAX_ADOPTIONS = 0

NEW_CANDIDATE_MIN_COUNT = 3
NEW_CANDIDATE_WINDOW_DAYS = 14


def _evaluate(source: Source) -> str | None:
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
    promoted = demoted = added = 0
    for source in list_active_sources():
        next_stage = _evaluate(source)
        if next_stage and source.id is not None:
            update_source_stage(source.id, next_stage)
            log.info("evolve.stage_change", source_id=source.id, value=source.value, to=next_stage)
            if next_stage == "active":
                promoted += 1
            elif next_stage == "demoted":
                demoted += 1

    per_lang: dict[Lang, int] = {}
    for lang in get_args(Lang):
        rows = candidate_keyword_frequencies(
            lang=lang,
            min_count=NEW_CANDIDATE_MIN_COUNT,
            days=NEW_CANDIDATE_WINDOW_DAYS,
        )
        for keyword, _ in rows:
            upsert_source(Source(kind="keyword", value=keyword, stage="candidate", lang=lang))
            added += 1
        per_lang[lang] = len(rows)
        log.info("evolve.candidates_per_lang", lang=lang, count=len(rows))

    summary = {"promoted": promoted, "demoted": demoted, "new_candidates": added}
    log.info("evolve.done", **summary, **{f"candidates_{k}": v for k, v in per_lang.items()})
    return summary
