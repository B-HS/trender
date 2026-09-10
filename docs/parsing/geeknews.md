# GeekNews

> 2026-09-11 재검증: **`.md` 엔드포인트 폐지 확인** — `https://news.hada.io/topic/{id}.md` → `410 Gone` ("GeekNews topic Markdown is no longer available. Use the original topic page instead.")

## fetch
- list feed: https://news.hada.io/rss/news — status 200, format **Atom** (`<feed>`/`<entry>`, NOT RSS despite the `/rss/` path)
- body source: **detail page SSR HTML** — `https://news.hada.io/topic?id={id}` (status 200, 본문 전문 포함 서버 렌더링)
- ⚠️ **UA gate**: 브라우저 아닌 기본 UA(node/curl)로 요청하면 `403` 반환. `fetch.ts`의 브라우저 UA 헤더 필수.
- JS rendering needed?: no — feed/list/detail 모두 서버 렌더링 (CSR 아님)

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
- full text location: detail page `https://news.hada.io/topic?id={id}` → 컨테이너 **`#topic_contents`** (`class='article-content'`, `itemprop='articleBody'`)
- HTML or markdown: **HTML** (`<ul>/<li>/<h2>/<hr>` 등, 절대 URL 링크만 포함 — 상대 src 없음)
- selectors: `['#topic_contents', '[itemprop="articleBody"]']` — 검증: 9.5KB+ 전문 추출 (id 33453)
- comments are **outside** the container (`#comment_thread`) — 본문을 원한다면 `#topic_contents` 셀렉터로 자동으로 제외됨
- example excerpt (실제 id 33453):
  ```html
  <ul>
  <li>Visa와 Mastercard는 카드를 발급하는 은행이 아니라, <strong>카드 소지자·발급사와 가맹점·매입사를 연결</strong>해 거래를 성사시키고 네트워크 참여를 늘리는 사업자임</li>
  ```

## gotchas
- Feed is **Atom, not RSS** — parse `<entry>` not `<item>`; URL is in `<id>`/`<link href>`, not a `<link>` text node.
- **UA gate**: 기본 UA로 상세/피드 요청 시 `403`. 브라우저 UA(`fetch.ts` DEFAULT_HEADERS)로 200 확인.
- `.md` 엔드포인트는 **410 영구 폐지** — 되돌리지 말 것.
- **External domains**: each topic links out to an external source. The feed `<content>` is a short (~100자) Korean summary, not the full body — 상세 페이지 fetch가 필요함.
