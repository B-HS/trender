"""1회용 백필: ① ja/en 리포트 전체 번역 → ② 최근 미번역 기사 N건 번역. 동시성 3.

백로그 기사는 translated_at 스탬프로 스킵돼 있어 일반 translate task 가 안 잡으므로,
content_translated_ko IS NULL 기준으로 직접 골라 테스트된 _translate_one 을 재사용한다.

실행: (repo root) uv run --project apps/parser python docs/utils/translate_recent.py
"""

from __future__ import annotations

import asyncio

from trender.concurrency import run_concurrent
from trender.db.connection import cursor
from trender.db.models import Article
from trender.llm.chain import build_chain
from trender.pipeline.translate import _translate_one, translate_reports_pending

_ARTICLE_LIMIT = 100


def _fetch_recent_articles(n: int) -> list[Article]:
    with cursor() as cur:
        cur.execute(
            """
            SELECT * FROM articles
            WHERE lang <> 'ko' AND content_translated_ko IS NULL
              AND content_original IS NOT NULL AND CHAR_LENGTH(content_original) > 0
            ORDER BY fetched_at DESC
            LIMIT %s
            """,
            (n,),
        )
        return [Article(**row) for row in cur.fetchall()]  # type: ignore[arg-type]


async def main() -> None:
    reports_done = await translate_reports_pending(limit=500)
    print(f"[reports] translated {reports_done}", flush=True)

    articles = _fetch_recent_articles(_ARTICLE_LIMIT)
    chain = build_chain("light")

    async def _worker(article: Article) -> bool:
        try:
            return await _translate_one(chain, article)
        except Exception as e:
            print(f"[fail] id={article.id} lang={article.lang} {e}", flush=True)
            return False

    try:
        done = await run_concurrent(articles, _worker)
    finally:
        await chain.aclose()
    print(f"[articles] translated {done} of {len(articles)}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
