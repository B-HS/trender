# 브라우저 제거 + 추출 폴백 (2026-06)

## 왜 제거하나
- `fetch/browser.py`(CloakBrowser) = 스텔스 Chromium(~200MB). **호출 조건 = plain httpx가 403/401/429 또는 `cf-mitigated`일 때만** (rss.py `_fetch_feed_bytes`, article.py `fetch_article_body`).
- CF 전수 감사 결과 일관 차단 0건 → **현재 한 번도 안 불리는 죽은 코드**. 200 페이지엔 애초에 발동 안 함(JS 렌더 이득도 현재 못 누림).
- 제거 시: cloakbrowser 의존성 + Playwright 베이스 이미지 + shm_size 제거 → 가볍고 빠르고 **serverless 호환**.

## 제거 체크리스트 (Python 기준; TS 포팅 시에도 동일 원칙)
- 삭제: `fetch/browser.py`.
- `fetch/rss.py`: import(L14) + browser fallback(L84-85) 제거 → 차단/실패 시 `return None`.
- `fetch/article.py`: import(L10) + browser 분기(L96-98) 제거.
- `pipeline/collect.py`: `shutdown_browser` import(L16)+호출(L97) 제거.
- `main.py`: `shutdown_browser` import(L9)+`_runner`(L119-123) 제거.
- `pyproject.toml`: `cloakbrowser` 제거(bs4/lxml/trafilatura/markdownify 유지).
- `Dockerfile`: 베이스 playwright→`python:3.12-slim`, `CLOAKBROWSER_CACHE_DIR`·워밍업 RUN 제거.
- `docker/compose.yml`: `cloak-cache` 볼륨·`shm_size: 1g` 제거.
- `entrypoint.sh`: env 화이트리스트에서 `PLAYWRIGHT_BROWSERS_PATH CLOAKBROWSER_CACHE_DIR` 제거.
- 테스트 영향 없음(browser mock 없음).

## 추출 폴백 (브라우저 없이 "JS 대응")
`_extract_main_html` 폴백 체인 (기존 의존성만):
1. trafilatura.extract (현행).
2. 실패/빈 결과 → **JSON-LD `articleBody`** (`<script type="application/ld+json">`).
3. 그래도 없으면 → `<article>`/`<main>` 컨테이너 best-effort.
- `__NEXT_DATA__`/`__NUXT__` 재귀 grep은 오삽입 위험으로 채택 안 함. KakaoTech(Nuxt SPA)는 얇게 남음(허용; 필요 시 카카오 내부 API 보강).
- TS 포팅 시: `@mozilla/readability`+`jsdom`+`turndown` + JSON-LD 폴백. **trafilatura 대비 품질 회귀 위험 → 채택 전 스파이크로 추출 길이 비교 필수.**

## 진짜 막히는 소스가 생기면
간헐 403 → 그 회차 스킵(다음 cron 재시도). 특정 소스가 지속 차단되면 그 소스만 공식/비공식 **API로 전환**(Qiita/Zenn/GeekNews처럼).
