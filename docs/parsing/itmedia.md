# ITmedia AI＋

## fetch
- list feed: `https://rss.itmedia.co.jp/rss/2.0/aiplus.xml` — status 200, content-type `application/xml`, format **rss 2.0** (UTF-8)
- body source: per-item article URL (HTML page). Feed `<description>` is summary only, not full body.
- JS rendering needed?: **no** — body is in static HTML (`#ArticleText`). curl with a UA is enough.

## list parsing
- per-item fields → mapping:
  - title → `<item><title>`
  - url → `<item><link>`
  - published_at → `<item><pubDate>` (RFC822, e.g. `Tue, 23 Jun 2026 13:12:15 +0900`)
  - author/source → none in feed (fixed channel: ITmedia AI＋). Derive author from article page (`p-article-info__author-name`).
  - summary → `<item><description>` (1–2 sentence lead)
  - extra → none
- exact tag names / namespace notes:
  - plain RSS 2.0, no extra namespaces. Path: `rss > channel > item`.
  - **IMPORTANT — links span multiple itmedia subdomains/templates.** Observed in one feed: `www.itmedia.co.jp/aiplus/...`, `atmarkit.itmedia.co.jp`, `monoist.itmedia.co.jp`, `kn.itmedia.co.jp`, plus `www.itmedia.co.jp/enterprise|business|news/...`. Body extraction below works across them (same `#ArticleText` / `#cmsBody` template family), but treat domain as variable.

## body parsing
- full text location: **CSS selector `#ArticleText`** (`<div id="ArticleText">`). Stable across both the modern `/aiplus/article/.../2000000xxx/` template and the legacy `/.../newsNNN.html` (Shift_JIS) template.
  - JSON-LD: there ARE `application/ld+json` blocks (4×) but **no `articleBody`** field → cannot use JSON-LD for body. Use JSON-LD/og only for title/date/image if wanted.
  - Noise inside `#ArticleText` to strip: inline ad slots (`<div id="PC_in-art-SpecialLink">`, `refreshGam(...)` script text, `#InArtSpecialLink`), related-article boxes.
- multi-page handling:
  - Long articles split into pages. URL pattern: page 2 = same path with `_2` before `.html`, e.g. `news011.html` → `news011_2.html` (`2000000xxx/` style would be `.../2000000xxx/index_2.html`-family; confirm per page).
  - **Detection (use this, most reliable): `<link rel="next" href="...">` in `<head>`.** Follow until absent.
  - Visible pager fallback: `<div class="ctrl"><span id="numb"><strong>1</strong>|<a href="newsNNN_2.html">2</a></span> <span id="next"><a href="...">次のページへ</a></span></div>`. Text marker `次のページ` is present.
  - Single-page articles have neither `rel="next"` nor `次のページ`; `_2.html` returns 404.
- example excerpt (~200 chars real, from `/aiplus/article/2606/22/2000000115/`):
  > ダイハツ工業は6月22日、AIを使った自動車部品の品質検査システムを、滋賀（竜王）工場第1地区に導入したと発表した。 アルミ加工ラインで生産されているトランスミッション用の部品について、AIで加工穴内部のキズなどを検査。人の目と感性に頼っていた検査工程の自動化に取り組んだ。 製品の微細なキズや不具合を判別する検査は、目を酷使するため負担がかかる。

## gotchas
- **Encoding is mixed.** Modern `/aiplus/article/.../2000000xxx/` pages are UTF-8 (`<meta charset>` + `Content-Type: text/html; charset=utf-8`). Legacy `/.../newsNNN.html` pages (the ones that paginate) are **Shift_JIS / cp932** and serve `content-type: text/html` with no charset header. Detect via `<meta charset=...>` and decode accordingly (try cp932 then utf-8), or you get mojibake.
- Non-AI noise: the AI＋ feed is curated to AI topics, but it pulls cross-channel (enterprise/business/security). If strict AI-only is required, post-filter by keyword — the feed itself does not guarantee 100% AI.
- CF risk: none observed (200 with simple UA).
- Inline ad/GAM `<script>` and related-article `<ul>` live inside `#ArticleText`; strip script/aside before taking text.
