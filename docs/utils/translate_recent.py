"""1회용: 최근 ja/en 각각 N건(번역 없는 것)을 한국어로 번역한다.

백로그는 translated_at 스탬프로 스킵 처리돼 있어 일반 translate task 가 잡지 않으므로,
content_translated_ko IS NULL 기준으로 직접 골라 테스트된 _translate_one 을 재사용한다.

실행: (repo root) uv run --project apps/parser python docs/utils/translate_recent.py
"""

from __future__ import annotations

import asyncio

from trender.db.connection import cursor
from trender.db.models import Article
from trender.llm.chain import build_chain
from trender.pipeline.translate import _translate_one

_PER_LANG = 50


def _fetch_recent(lang: str, n: int) -> list[Article]:
    with cursor() as cur:
        cur.execute(
            """
            SELECT * FROM articles
            WHERE lang=%s AND content_translated_ko IS NULL
              AND content_original IS NOT NULL AND CHAR_LENGTH(content_original) > 0
            ORDER BY fetched_at DESC
            LIMIT %s
            """,
            (lang, n),
        )
        return [Article(**row) for row in cur.fetchall()]  # type: ignore[arg-type]


async def main() -> None:
    articles = _fetch_recent("ja", _PER_LANG) + _fetch_recent("en", _PER_LANG)
    chain = build_chain("light")
    done = 0
    try:
        for i, article in enumerate(articles, 1):
            try:
                if await _translate_one(chain, article):
                    done += 1
            except Exception as e:
                print(f"[fail] id={article.id} lang={article.lang} {e}", flush=True)
            print(f"[progress] {i}/{len(articles)} done={done}", flush=True)
    finally:
        await chain.aclose()
    print(f"[finished] translated {done} of {len(articles)}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
