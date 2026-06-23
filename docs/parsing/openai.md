# OpenAI (vendor=openai)

## fetch
- list feed: https://openai.com/news/rss.xml — status 200, format RSS 2.0 (`text/xml`, ~617 KB, 1016 items). Channel `<lastBuildDate>` Tue, 23 Jun 2026 05:08:31 GMT (live).
- body source: article URL from `<link>`, e.g. https://openai.com/index/patch-the-planet
- JS rendering needed?: indeterminate from this environment — the article HTML is **Cloudflare bot-blocked (HTTP 403)**. Raw `curl` (both `Mozilla/5.0 (Macintosh)` and full Chrome UA) and `WebFetch` both return a 403 challenge page (~10 KB, just the CF/branding shell, no article, no `__NEXT_DATA__`, no JSON-LD). The "~11.7k chars without browser" figure must come from a different egress IP / extraction proxy, not reproducible here. The list feed itself is NOT blocked.

## list parsing
- per-item fields → mapping:
  - title ← `<title>` (CDATA)
  - url ← `<link>` (also `<guid isPermaLink="true">`, identical)
  - published_at ← `<pubDate>` (RFC-822, e.g. `Mon, 22 Jun 2026 10:00:00 GMT`)
  - author ← **none in feed** (no `<author>` / `<dc:creator>`) → fixed "OpenAI"
  - summary ← `<description>` (CDATA, 1–2 sentence blurb)
- extra: `<category>` (e.g. `Security`) available for tab/topic.
- exact tag names: `title`, `link`, `guid`, `description`, `category`, `pubDate`

## body parsing
- full text location: article body lives on the page HTML but is **gated by Cloudflare** in this environment. When reachable, OpenAI `/index/*` and `/news/*` pages are Next.js — extraction should target the readable article container (readability/Mozilla-Readability over the article HTML). `description` from the feed is the only guaranteed static text here.
- example excerpt (~200 chars real): **unavailable** — only the 403 page is returned (`body{font-family:Arial,Helvetica,sans-serif}.container{align-items:center;display:flex;...}` — the CF challenge stylesheet, no article text).
- measured body length: feed `description` ≈ 180 chars (reproducible). Full article body NOT measurable here (403). Reported external figure ~11.7k chars.

## gotchas
- **Cloudflare 403 on article bodies** from this IP/UA. Crawler will likely need a residential/rotating egress or a render/extract service; verify in the crawler's actual runtime. If body fetch fails, fall back to feed `description` as summary.
- vendor mapping: vendor=openai (company-news tab).
- No author field — hardcode "OpenAI".
