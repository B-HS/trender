from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Literal

from trender.db.models import Article, Report, ReportItem, ReportKind
from trender.db.repositories import (
    fetch_articles_in_range,
    increment_source_stat,
    insert_report,
    replace_report_items,
)
from trender.llm.base import KOREAN_MARKDOWN_SYSTEM_PROMPT
from trender.llm.chain import build_default_chain
from trender.logging import get_logger

log = get_logger(__name__)


def _period_bounds(kind: ReportKind, ref: date) -> tuple[date, date]:
    """ref(보통 cron 발행일) 기준으로 직전 마감된 기간을 돌려준다."""
    if kind == "daily":
        d = ref - timedelta(days=1)
        return (d, d)
    if kind == "weekly":
        # 월요일 새벽에 발행되면 ref.weekday()==0, 지난주 월~일 구간을 리턴
        end = ref - timedelta(days=ref.weekday() + 1)  # 지난주 일요일
        start = end - timedelta(days=6)
        return (start, end)
    # monthly: 지난달 1일 ~ 말일
    first_of_this = ref.replace(day=1)
    end = first_of_this - timedelta(days=1)
    start = end.replace(day=1)
    return (start, end)


def _rank_articles(articles: list[Article], top_k: int) -> list[Article]:
    scored = [a for a in articles if a.summary_ko]
    scored.sort(key=lambda a: (a.published_at or a.fetched_at or datetime.min), reverse=True)
    return scored[:top_k]


def _format_user_prompt(kind: ReportKind, start: date, end: date, articles: list[Article]) -> str:
    bullets = []
    for i, a in enumerate(articles, 1):
        bullets.append(
            f"{i}. [{a.lang}] {a.title_ko or a.title_original}\n   URL: {a.url}\n   요약: {a.summary_ko}"
        )
    label = {"daily": "일간", "weekly": "주간", "monthly": "월간"}[kind]
    return (
        f"아래는 {start} ~ {end} 기간({label}) 동안 수집된 AI 관련 기사 요약 목록이다. "
        "이를 토대로 한국어 markdown 리포트를 작성해라.\n\n"
        "리포트 구조:\n"
        "1. 제목 (# 한 줄)\n"
        "2. 한 문단 도입 (이번 기간의 큰 흐름)\n"
        "3. '## 핵심 트렌드' 섹션 (불릿 3~5개, 각 항목에 관련 기사 번호 인용)\n"
        "4. '## 주목할 기사' 섹션 (불릿. 각 기사: **제목** — 한 줄 코멘트 + URL)\n"
        "5. '## 향후 관전 포인트' 섹션 (불릿 2~3개)\n\n"
        "기사 목록:\n"
        + "\n\n".join(bullets)
    )


async def generate_report(kind: ReportKind, ref: date | None = None, top_k: int = 15) -> int | None:
    today = ref or date.today()
    start, end = _period_bounds(kind, today)
    range_start = datetime.combine(start, time.min)
    range_end = datetime.combine(end, time.max)
    articles = fetch_articles_in_range(range_start, range_end)
    selected = _rank_articles(articles, top_k=top_k)
    if not selected:
        log.warning("report.empty", kind=kind, period_start=str(start), period_end=str(end))
        return None

    user_prompt = _format_user_prompt(kind, start, end, selected)
    chain = build_default_chain()
    try:
        markdown = await chain.complete(system=KOREAN_MARKDOWN_SYSTEM_PROMPT, user=user_prompt, temperature=0.3)
    finally:
        await chain.aclose()

    title_ko = _extract_title(markdown, fallback=f"{kind} 리포트 {start} ~ {end}")
    report = Report(
        kind=kind,
        period_start=start,
        period_end=end,
        title_ko=title_ko[:500],
        markdown_ko=markdown,
    )
    report_id = insert_report(report)
    items = [ReportItem(report_id=report_id, article_id=a.id, rank=i) for i, a in enumerate(selected, 1) if a.id]
    replace_report_items(report_id, items)
    for a in selected:
        if a.source_id:
            increment_source_stat(a.source_id, today, adoption=1)
    log.info("report.done", report_id=report_id, kind=kind, items=len(items))
    return report_id


def _extract_title(markdown: str, fallback: str) -> str:
    for line in markdown.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line.lstrip("# ").strip()
    return fallback
