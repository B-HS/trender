# Publickey

## fetch
- list feed: `https://www.publickey1.jp/atom.xml` — status 200, content-type `application/xml`, format **atom** (`<feed xmlns="http://www.w3.org/2005/Atom">`, UTF-8, Movable Type Pro)
- body source: **article HTML page** (the feed `<content>` is TRUNCATED, not full). Article URL from `<entry><link rel="alternate">`.
- JS rendering needed?: **no** — body is static HTML in `div.entrybody`.

## list parsing
- per-item fields → mapping:
  - title → `<entry><title>`
  - url → `<entry><link rel="alternate" type="text/html" href="...">` (use the `rel="alternate"` link; href, not text)
  - published_at → `<entry><published>` (ISO8601 UTC, e.g. `2026-06-22T15:14:38Z`); also `<updated>`
  - author/source → `<entry><author><name>` (e.g. `jniino`)
  - summary → `<entry><summary>` (short) and/or `<entry><content type="html">` (longer but still truncated, ends with `……`)
  - extra → `<entry><category term="..." label="..." scheme="...">` (multiple; `scheme=...#category` = category, `...#tag` = tag). `<entry><id>` = `tag:www.publickey1.jp,2026://2.NNNN`.
- exact tag names / namespace notes:
  - Atom namespace `http://www.w3.org/2005/Atom`. Path: `feed > entry`.
  - `<content type="html" xml:lang="ja" xml:base="https://www.publickey1.jp/">` — HTML-escaped, **truncated lead** (trails with `……`). **Do NOT treat as full body.**

## body parsing
- full text location: **CSS selector `div.entrybody`** (class `entrybody clearfix`), inside `#maincol`.
  - JSON-LD: **no `articleBody`** in page (`articleBody` absent). Use `#maincol > div.entrybody`.
- multi-page handling: N/A (Publickey articles are single-page).
- example excerpt (~200 chars real, from `/blog/26/githubai_1.html`):
  > GitHubは、ユーザーに対してプルリクエスト数の上限を設定できる 新機能の導入を発表しました 。 Pull requests are easier to open than ever, but every review still takes human effort. ... 生成AIによるコーディング支援が普及したことにより、誰もが気軽に

## gotchas
- Body mixes Japanese prose with embedded English (quoted release text) and embedded tweets/`pic.twitter.com` blockquote markup + `&mdash;` — strip `<blockquote>`/`<script>` (Twitter embeds) when you want clean text.
- Feed `<content>` looks full at a glance but is cut off (`……`) → must fetch the article page for real body. This is the main trap.
- Encoding: UTF-8 throughout (feed and pages). `content-type: text/html` on article has no charset but body is UTF-8.
- CF risk: none observed (200 with simple UA). Tech-focused single domain → low noise, no non-IT filtering needed.
