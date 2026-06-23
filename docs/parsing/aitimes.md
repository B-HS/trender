# AI타임스 (AITimes)

## fetch
- list feed: https://www.aitimes.com/rss/allArticle.xml — status 200, format **RSS 2.0**
- body source: **article URL** — `https://www.aitimes.com/news/articleView.html?idxno={idxno}` (status 200, ~142KB HTML)
- JS rendering needed?: **no** — server-rendered CMS (Korean newspaper CMS, "klanguage"-style); body present in static HTML

## list parsing
- per-item fields → mapping (each `<item>`):
  - title ← `<title>`
  - url ← `<link>` (e.g. `https://www.aitimes.com/news/articleView.html?idxno=212008`)
  - published_at ← `<pubDate>` (format `2026-06-23 13:58:38` — **space-separated, NOT RFC822**; parse as local KST `%Y-%m-%d %H:%M:%S`)
  - author ← `<author>` (CDATA, e.g. `박찬 기자`)
  - summary ← `<description>` (CDATA)
- exact tag names: `item`, `title`, `link`, `author`, `pubDate`, `description`

## body parsing
- full text location: selector **`#article-view-content-div`** (also `itemprop="articleBody"`)
  - exact element: `<article id="article-view-content-div" class="article-veiw-body view-page" itemprop="articleBody">`
- HTML or markdown: **HTML** — extract inner text; strip figures/`(사진=...)` captions and the leading "기사를 읽어드립니다." TTS widget
- example excerpt (~200 chars real):
  ```
  사카나 AI가 여러 전문 AI 모델을 상황에 따라 조합·조율해 단일 모델처럼 동작하는 새로운 AI 오케스트레이션 시스템을 출시했다. 이를 통해 현존 최강으로 알려진 ...
  ```

## gotchas
- `pubDate` is **non-standard** (`YYYY-MM-DD HH:MM:SS`, no timezone) — do not use an RFC822 parser; treat as KST.
- Note the class typo `article-veiw-body` (vendor typo, keep as-is if matching by class). Prefer the stable `id="article-view-content-div"` / `itemprop="articleBody"`.
- Body contains a TTS prefix ("기사를 읽어드립니다.") and `(사진=...)` captions — clean these out.
