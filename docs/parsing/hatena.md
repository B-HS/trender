# はてなブックマーク 人気エントリー - テクノロジー

## fetch
- list feed: `https://b.hatena.ne.jp/hotentry/it.rss` — status 200, content-type `application/xml`, format **RSS 1.0 / RDF** (`<rdf:RDF>`, UTF-8). ~30 items.
- body source: **external article URLs on arbitrary domains** (zenn.dev, qiita.com, *.impress.co.jp, note.com, github.com, *.hatenadiary.jp, company tech blogs, itmedia, etc.). The feed itself carries only title/summary/bookmark count — NOT the article body.
- JS rendering needed?: depends on the external domain (per-item). Feed parsing itself: no.

## list parsing
- per-item fields → mapping (per `<item>`):
  - title → `<title>` (numeric char refs like `&#x306F;...` → decode entities)
  - url → `<link>` (= `rdf:about` of the item) → **external article URL**
  - published_at → `<dc:date>` (ISO8601 UTC, e.g. `2026-06-22T04:16:12Z`)
  - author/source → no author; **source = the external domain** of `<link>` (derive host). `dc:subject` (multiple) = tags.
  - summary → `<description>` (lead snippet, trails with `...`)
  - extra (hatena count) → **`<hatena:bookmarkcount>`** (e.g. `277`) — confirmed present on all items (30/30).
- exact tag names / namespace notes:
  - Namespaces: `rdf` (`...22-rdf-syntax-ns#`), default `purl.org/rss/1.0/`, `content` (`content:encoded`), `dc`, `hatena` (`http://www.hatena.ne.jp/info/xmlns#`), `syn`, `taxo`.
  - Structure: `<channel><items><rdf:Seq><rdf:li rdf:resource="..."/>` lists ordering; actual data in sibling top-level `<item rdf:about="URL">` elements (RDF, not nested under channel). Iterate `<item>` elements directly.
  - hatena-specific tags: `hatena:bookmarkcount`, `hatena:bookmarkCommentListPageUrl` (= `https://b.hatena.ne.jp/entry/s/<url-no-scheme>`), `hatena:imageurl`, `hatena:bookmarkSiteEntriesListUrl`.
  - `content:encoded` exists but is **hatena's own blockquote+thumbnail+bookmark-button markup**, NOT the article body — do not use for body.

## body parsing
- full text location: **on the external page → no single selector.** Must fetch each `<link>` and run a generic readability/extractor (e.g. Readability/trafilatura/og fallback), since domains vary.
  - Practical strategy: per-domain handler for the common hosts (zenn `article` body, qiita `.it-MdContent`, impress `.article` / `#main`, note `.note-common-styles__textnote-body`, hatenadiary `.entry-content`, itmedia `#ArticleText` — see itmedia.md), with a generic JSON-LD `articleBody` / `og:description` + Readability fallback for the long tail.
- multi-page handling: N/A at feed level (per external domain if any).
- example excerpt (~200 chars real, from `<description>` of top item, zenn.dev):
  > なぜ私はWBSを「至高」と呼ぶのか たいていのプロジェクトは、不確実性が高い。やるべき作業の全体像が見えないまま、それでもゴールまでの道筋を引かなければならない。 WBSの本質は、ここにある。いま認識している作業を一覧にし、その一つひとつに「もっと分解できないか」と目を向けさせてくれる。 価値があるのは、...

## gotchas
- **CF / bot-block risk is HIGH and per-domain.** Aggregates arbitrary external sites; some will Cloudflare-challenge, 403, or require JS. **Strategy: skip-on-failure** — if fetch is non-200 / challenged / empty body, drop that item (still keep feed-level title+url+count) and continue. Do not let one bad domain fail the batch.
- Encoding: feed is UTF-8 but uses **numeric character references** (`&#xHHHH;`) for all Japanese — must HTML-entity-decode title/description. External pages: encoding varies (UTF-8 mostly; some legacy Shift_JIS, e.g. impress/itmedia) → detect charset per page.
- Noise (non-AI/non-IT): "IT" hotentry is broad tech, NOT AI-only (games via automaton-media, gadgets via pc.watch, exam syllabus via ipa.go.jp appeared). If AI-only is required, post-filter by `dc:subject`/title keywords.
- `<link>` may point at non-article resources (e.g. github.com repo, togetter.com matome) → extraction quality varies; treat body as best-effort.
- Ordering: trust `<rdf:Seq>` order = popularity ranking; `<item>` elements may not preserve it — sort items by Seq if rank matters.
