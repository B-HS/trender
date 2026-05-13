from __future__ import annotations

from datetime import date, datetime
from typing import Iterable, Sequence

from trender.db.connection import cursor
from trender.db.models import (
    Article,
    KeywordExtracted,
    Report,
    ReportItem,
    Source,
    SourceStage,
)


def upsert_source(src: Source) -> int:
    with cursor() as cur:
        cur.execute(
            """
            INSERT INTO sources (kind, value, stage, lang)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              stage = CASE
                WHEN stage = 'active' THEN 'active'
                WHEN VALUES(stage) = 'active' THEN 'active'
                ELSE stage
              END,
              lang = COALESCE(VALUES(lang), lang)
            """,
            (src.kind, src.value, src.stage, src.lang),
        )
        if cur.lastrowid:
            return int(cur.lastrowid)
        cur.execute("SELECT id FROM sources WHERE kind=%s AND value=%s", (src.kind, src.value))
        row = cur.fetchone()
        return int(row["id"])  # type: ignore[index]


def list_active_sources(kind: str | None = None) -> list[Source]:
    sql = "SELECT * FROM sources WHERE stage IN ('active', 'candidate')"
    params: tuple = ()
    if kind:
        sql += " AND kind = %s"
        params = (kind,)
    with cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        return [Source(**row) for row in rows]  # type: ignore[arg-type]


def insert_article_if_new(article: Article) -> int | None:
    with cursor() as cur:
        cur.execute(
            """
            INSERT IGNORE INTO articles
              (source_id, url, lang, title_original, content_original, published_at, fetched_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                article.source_id,
                article.url,
                article.lang,
                article.title_original,
                article.content_original,
                article.published_at,
            ),
        )
        if cur.lastrowid and cur.rowcount == 1:
            return int(cur.lastrowid)
        return None


def fetch_articles_missing_summary(limit: int = 50) -> list[Article]:
    with cursor() as cur:
        cur.execute(
            """
            SELECT * FROM articles
            WHERE summary_ko IS NULL
            ORDER BY fetched_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        return [Article(**row) for row in cur.fetchall()]  # type: ignore[arg-type]


def update_article_summary(article_id: int, title_ko: str, summary_ko: str) -> None:
    with cursor() as cur:
        cur.execute(
            "UPDATE articles SET title_ko=%s, summary_ko=%s WHERE id=%s",
            (title_ko, summary_ko, article_id),
        )


def update_article_content(article_id: int, content_original: str) -> None:
    with cursor() as cur:
        cur.execute(
            "UPDATE articles SET content_original=%s WHERE id=%s",
            (content_original, article_id),
        )


def insert_keywords(article_id: int, keywords: Iterable[KeywordExtracted]) -> None:
    rows = [(article_id, k.keyword_ko, k.keyword_original, k.score) for k in keywords]
    if not rows:
        return
    with cursor() as cur:
        cur.executemany(
            "INSERT INTO keywords_extracted (article_id, keyword_ko, keyword_original, score) VALUES (%s, %s, %s, %s)",
            rows,
        )


def fetch_articles_in_range(start: datetime, end: datetime) -> list[Article]:
    with cursor() as cur:
        cur.execute(
            """
            SELECT * FROM articles
            WHERE COALESCE(published_at, fetched_at) BETWEEN %s AND %s
            ORDER BY COALESCE(published_at, fetched_at) DESC
            """,
            (start, end),
        )
        return [Article(**row) for row in cur.fetchall()]  # type: ignore[arg-type]


def insert_report(report: Report) -> int:
    with cursor() as cur:
        cur.execute(
            """
            INSERT INTO reports (kind, period_start, period_end, title_ko, markdown_ko)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              title_ko = VALUES(title_ko),
              markdown_ko = VALUES(markdown_ko),
              id = LAST_INSERT_ID(id)
            """,
            (report.kind, report.period_start, report.period_end, report.title_ko, report.markdown_ko),
        )
        return int(cur.lastrowid)


def replace_report_items(report_id: int, items: Sequence[ReportItem]) -> None:
    with cursor() as cur:
        cur.execute("DELETE FROM report_items WHERE report_id=%s", (report_id,))
        if items:
            cur.executemany(
                "INSERT INTO report_items (report_id, article_id, `rank`) VALUES (%s, %s, %s)",
                [(report_id, it.article_id, it.rank) for it in items],
            )


def increment_source_stat(source_id: int, on: date, hit: int = 0, adoption: int = 0) -> None:
    with cursor() as cur:
        cur.execute(
            """
            INSERT INTO source_stats (source_id, date, hit_count, adoption_count)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              hit_count = hit_count + VALUES(hit_count),
              adoption_count = adoption_count + VALUES(adoption_count)
            """,
            (source_id, on, hit, adoption),
        )


def update_source_stage(source_id: int, stage: SourceStage) -> None:
    with cursor() as cur:
        if stage == "active":
            cur.execute(
                "UPDATE sources SET stage=%s, promoted_at=NOW(), last_used_at=NOW() WHERE id=%s",
                (stage, source_id),
            )
        else:
            cur.execute("UPDATE sources SET stage=%s WHERE id=%s", (stage, source_id))


def stats_summary_for_source(source_id: int, days: int) -> dict[str, int]:
    with cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(hit_count), 0) AS hits,
                   COALESCE(SUM(adoption_count), 0) AS adoptions
            FROM source_stats
            WHERE source_id=%s AND date >= (CURDATE() - INTERVAL %s DAY)
            """,
            (source_id, days),
        )
        row = cur.fetchone() or {}
        return {"hits": int(row.get("hits", 0)), "adoptions": int(row.get("adoptions", 0))}  # type: ignore[union-attr]


def candidate_keyword_frequencies(min_count: int = 3, days: int = 14) -> list[tuple[str, str | None, int]]:
    with cursor() as cur:
        cur.execute(
            """
            SELECT keyword_ko, MAX(keyword_original) AS keyword_original, COUNT(*) AS cnt
            FROM keywords_extracted
            WHERE created_at >= (NOW() - INTERVAL %s DAY)
            GROUP BY keyword_ko
            HAVING cnt >= %s
            """,
            (days, min_count),
        )
        return [(r["keyword_ko"], r["keyword_original"], int(r["cnt"])) for r in cur.fetchall()]  # type: ignore[index]
