# KakaoTech (tech.kakao.com)

## fetch
- list feed: https://tech.kakao.com/feed/ — **redirects** (meta-refresh `0; url=/feed`) → use **https://tech.kakao.com/feed** directly. status 200, format **RSS 2.0** (~12KB)
- body source: article URL `https://tech.kakao.com/posts/{id}` — **but body is NOT reachable from static HTML** (see below)
- JS rendering needed?: **YES (SPA)** — Nuxt app. Fetched article HTML is 97KB but **stripped visible text = 772 chars** and that is **all chrome** (nav/menu + the literal "이 페이지를 실행하려면 자바스크립트를 사용해야 합니다." = "JavaScript required"). The actual article body requires JS execution.

## list parsing
- per-item fields → mapping (each `<item>`):
  - title ← `<title>` (CDATA)
  - url ← `<link>` (e.g. `https://tech.kakao.com/posts/824`)
  - published_at ← `<pubDate>` (RFC822, e.g. `Mon, 15 Jun 2026 15:00:00 GMT`)
  - author ← `<dc:creator>` (e.g. `rupert.kim`)
  - summary ← `<description>` (CDATA, ~258 chars) — **this is the only body text we get**
- exact tag names: `item`, `title`, `link`, `pubDate`, `dc:creator`, `category`, `description`
- (namespaces: `dc:`, `content:`, `atom:` declared, but **no `<content:encoded>` present** in items)

## body parsing
- full text location: **none reachable statically**. JSON-LD exists (`@type: BlogPosting`) but **`articleBody` is ABSENT**. `<meta name="description">` = 48 chars. Feed `<description>` = ~258 chars (intro only).
- HTML or markdown: n/a (SPA, JS-rendered DOM)
- example excerpt (~200 chars real — from feed `<description>`, the best available):
  ```
  AI 에이전트로 카카오톡 추천 지표 분석 자동화하기: Hadoop 기반 도입 사례
  안녕하세요. 소셜추천엔진팀에서 숏폼 추천 모델을 개발하고 있는 루퍼트(rupert)입니다.
  추천 시스템을 개발하다 보면 코드를 짜는 시간만큼이나 데이터를 들여다보는 시간이 길어집니다...
  ```

## gotchas
- **SPA thinness (CONFIRMED)**: Nuxt SPA. Static article HTML yields only ~772 chars of chrome text; JSON-LD `articleBody` empty; usable body = feed `<description>` (**~258 chars** measured, the prompt's "~244 chars" expectation confirmed). **Full body is not crawlable without a headless browser.**
- **Limitation**: ingest title + ~258-char `<description>` summary only; do not expect full article text from static fetch.
- **Future**: to get full body either (a) render with a headless browser (Playwright) to hydrate the Nuxt DOM, or (b) use an **internal Kakao API** (the Nuxt app fetches `/posts/{id}` JSON from an API endpoint — capture via network inspection) for clean articleBody.
- Feed root `https://tech.kakao.com/feed/` returns a meta-refresh redirect; fetch `https://tech.kakao.com/feed` (no trailing slash).
