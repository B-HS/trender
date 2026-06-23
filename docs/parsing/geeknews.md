# GeekNews

## fetch
- list feed: https://news.hada.io/rss/news — status 200, format **Atom** (`<feed>`/`<entry>`, NOT RSS despite the `/rss/` path)
- body source: **`.md` endpoint** — `https://news.hada.io/topic/{id}.md` (status 200, ~18KB, full text + comments in clean markdown)
- JS rendering needed?: no — feed is Atom XML; `.md` endpoint is server-rendered markdown

## list parsing
- per-item fields → mapping (each `<entry>`):
  - title ← `<title>` (CDATA)
  - url ← `<id>` or `<link rel='alternate' href='...'/>` = `https://news.hada.io/topic?id={id}`
  - published_at ← `<published>` (ISO8601 `+09:00`, e.g. `2026-06-23T12:36:13+09:00`)
  - author ← `<author><name>` (e.g. `neo`)
  - summary ← `<content type='html'>` (CDATA, HTML `<ul><li>` snippet)
- exact tag names: `entry`, `title`, `id`, `link`, `updated`, `published`, `author/name`, `author/uri`, `content`
- **topic id extraction**: id/link contains `topic?id=30756` → regex `id=(\d+)` → `{id}` = `30756`

## body parsing
- full text location: **`.md` endpoint** `https://news.hada.io/topic/{id}.md` — section `## Topic Body` (and `## Comments`)
- HTML or markdown: **markdown** (already clean, no DOM parse needed)
- example excerpt (~200 chars real):
  ```
  ## Topic Body
  - Flock은 사람 대신 차량만 추적한다고 설명하지만, **번호판 조회**가 전 연인과 연애 경쟁자의 위치를 찾는 데 반복적으로 쓰인 사례가 드러남
  - Illinois Holiday Hills 경찰서장은 Prairie Grove Police Department의 **Flock LPR**과 Illinois State Police LEADS 데이터...
  ```
  The `.md` Metadata block also exposes `Original source: [ipvm.com](...)` — the external article link.

## gotchas
- Feed is **Atom, not RSS** — parse `<entry>` not `<item>`; URL is in `<id>`/`<link href>`, not a `<link>` text node.
- **External domains**: each topic links out to an external source (the `Original source` in the `.md`). The `<content>` in the feed is just a short Korean summary, not the source article. The `.md` endpoint gives GeekNews's own curated body + comments, which is the reliable text to ingest.
- Use the `.md` endpoint instead of scraping the external source (avoids per-domain extraction).
