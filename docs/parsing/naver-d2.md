# Naver D2

## fetch
- list feed: https://d2.naver.com/d2.atom — status 200, format **Atom** (~122KB, ~20 entries)
- body source: **feed itself** — `<content>` holds the article HTML; page fetch NOT required
- JS rendering needed?: the article **page IS a SPA** (Vue, 4KB shell `#wrap` + `app.js`, body not in static HTML) — but the **Atom feed already embeds the content**, so we avoid the SPA entirely by reading from the feed

## list parsing
- per-item fields → mapping (each `<entry>`):
  - title ← `<title>`
  - url ← `<link href='...'/>` (e.g. `https://d2.naver.com/helloworld/7056385`)
  - published_at ← `<updated>` (ISO8601) — note: feed exposes `updated`, not `published`, per entry
  - author ← **not per-entry**; feed-level `<author>` only → fallback null
  - summary ← derive from `<content>` (first paragraph) or use `<category>`
- exact tag names: `entry`, `title`, `link`, `id`, `updated`, `content`, `category`

## body parsing
- full text location: **`<content type='html'>`** in the Atom entry (~1.5KB+ HTML, entity-escaped)
- HTML or markdown: **HTML** (escaped `&lt;p&gt;`, embedded `<iframe>` for slide/video). Unescape entities then parse.
- example excerpt (~200 chars real, after decode + strip):
  ```
  네이버 사내 기술 교류 행사인 NAVER ENGINEERING DAY 2026(5월)에서 발표되었던 세션을 공개합니다. 발표 내용: 팀 내 데이터/서빙 레이어 자산을 자동으로 수집하여 제공하는 AI 플랫폼 마련 및 이를 통한 팀 내 업무 효율화 경험을 공유합니다...
  ```

## gotchas
- **SPA**: the article web page is a Vue SPA — do NOT scrape `d2.naver.com/helloworld/{id}` HTML (returns a 4KB JS shell with empty body). Use the feed `<content>` instead.
- Many D2 posts are **slide/video presentations** — `<content>` is often a short intro + an `<iframe>` (e.g. ENGINEERING DAY session), so body text can be thin. Capture the iframe URL if needed.
- No per-entry author; only feed-level author.
