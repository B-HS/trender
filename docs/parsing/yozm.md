# 요즘IT (Yozm / Wishket)

## fetch
- list feed: https://yozm.wishket.com/magazine/feed/ — status 200, format **RSS 2.0** (`xmlns:content` namespace, ~800KB, ~30 items)
- body source: **feed itself** — full article HTML is in `<content:encoded>`; no page fetch needed
- JS rendering needed?: no — full content embedded in feed

## list parsing
- per-item fields → mapping (each `<item>`):
  - title ← `<title>`
  - url ← `<link>` (e.g. `https://yozm.wishket.com/magazine/detail/3815`); same as `<guid>`
  - published_at ← **NOT in item** → fallback (see gotchas)
  - author ← **NOT in item** (no `<dc:creator>`/`<author>`) → null / fallback to scraping article page if needed
  - summary ← `<description>` (plain-text Korean intro)
- exact tag names: `item`, `title`, `link`, `description`, `guid`, `content:encoded`
- (channel-level only: `lastBuildDate`, `language`)

## body parsing
- full text location: **`<content:encoded>`** in the feed item
- HTML or markdown: **HTML** — double-encoded: the field holds `<![CDATA[ ... ]]>` whose inner text is HTML-entity-escaped (`&lt;p&gt;...`). Decode entities once, then parse HTML (`<p>`, `<blockquote>`, `<h4>`, `<strong>`).
- example excerpt (~200 chars real, after decode + strip):
  ```
  지난 10여 년 동안 기업용 소프트웨어의 중심에는 SaaS(Software as a Service)가 있었다. CRM은 영업 조직의 표준 도구가 되었고, ERP는 재무와 구매 흐름을 관리했으며, HRIS는 사람과 조직의 정보를 기록했다...
  ```

## gotchas
- **Date fallback**: items have **NO `<pubDate>`/`<dc:date>`**. Only channel `<lastBuildDate>` (RFC822, e.g. `Tue, 23 Jun 2026 09:35:01 +0000`) exists. Fallback chain: (1) crawl timestamp / ingest time, or (2) scrape the article detail page for its published date if accurate dates are required. Do not assume per-item dates from the feed.
- **No author** in feed — leave null or scrape page.
- `<content:encoded>` is **double-escaped** (CDATA wrapping HTML-entity-escaped HTML, with an extra leading `<![CDATA[`). Unescape HTML entities before DOM parsing.
