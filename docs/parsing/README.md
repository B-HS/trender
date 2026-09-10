# 파싱 전략 개요 (provider 추상화 입력)

> 2026-06-23 전 소스 라이브 curl 검증 결과 요약. 소스별 상세는 같은 폴더의 `<소스>.md`.
> 이 문서는 4단계 provider 추상화(`fetch` 전략 분기)의 설계 입력이다.

## fetch 전략 분류 (검증 후 확정)

| 전략 | 의미 | 소스 |
|------|------|------|
| `feed-full` | 피드에 전문 포함 → 본문 추가 fetch 불필요 | Anthropic(`<description>`), 요즘IT(`content:encoded`), MarkTechPost(`content:encoded`), Simon Willison(`<summary type=html>`), Raschka(`content:encoded`, 유료글 truncate), Naver D2(`<content>`) |
| `api` | 전용 JSON API | Zenn(`/api/articles/{slug}`→`body_html`), Qiita(`/api/v2/items` `rendered_body`/`body` inline) |
| `feed+article` | 피드는 목록, 본문은 기사 URL 재fetch + 셀렉터 | ITmedia(`#ArticleText`), Publickey(`div.entrybody`), AITimes(`#article-view-content-div`), OpenAI, HuggingFace(`div.blog-content`), DeepMind(`div.rich-text`), Google Research(`div.rich-text`) |
| `feed+article` | hada 상세 페이지 SSR (`#topic_contents`) | GeekNews(`/topic?id={id}`) — `.md` 엔드포인트 410 폐지(2026-09-11) |
| `feed-only(thin)` | 본문 확보 불가 → 피드 요약만 | KakaoTech(SPA, ~258자) |
| `aggregator` | 외부 임의 도메인 → per-domain + readability fallback, 실패 시 skip | はて브 hotentry |

## ⚠️ 검증으로 드러난 중요 수정 (표와 다름)

1. **Qiita `likes_count:>N` 무효** — 연산자가 조용히 무시됨. **`stocks:>N`** 으로 인기 필터링 (검증: stocks>50 이 likes 52~100 반환).
2. **OpenAI 기사 본문 Cloudflare 403** — 이 환경(로컬 curl + WebFetch) 둘 다 403. 피드(목록)는 정상. → **사용자 확인 필요** (Vercel 런타임 egress 에서 통과하는지). 통과 못 하면 본문은 피드 `description` fallback.
3. **ITmedia 페이지네이션 본문은 Shift_JIS(cp932)** — charset 헤더 없음. `<meta charset>` 감지 후 cp932 디코드 안 하면 mojibake.
4. **Anthropic 본문은 `content:encoded` 가 아니라 `<description>`** 에 전문. 단일 3rd-party 미러(롤링 20개) → **staleness 알림 필요**. (검증일 최신글 Jun 18, lastBuild Jun 22 = fresh)
5. **Simon Willison 본문은 `<content>` 가 아니라 `<summary type="html">`**.
6. **Raschka 유료글 truncate** — "Read more" teaser 로 끝남 → flag/skip.
7. **Naver D2 기사 페이지는 Vue SPA** 지만 Atom `<content>` 에 본문 포함 → 페이지 fetch 불필요. 슬라이드/iframe 전용 글은 본문 얇음.
8. **KakaoTech 확정** — Nuxt SPA, JSON-LD `articleBody` 부재, 정적 HTML 은 chrome 뿐. 사용 가능 본문 = 피드 `description` ~258자. 전문은 headless 또는 내부 API 필요(추후).
9. **GeekNews 피드는 Atom**, topic id 는 `<id>`/`<link>`의 `?id=` 에서 추출. `.md` 엔드포인트는 **410 폐지** → 본문은 상세 페이지 `#topic_contents` (UA gate: 브라우저 UA 없으면 403).
10. **요즘IT 피드에 per-item 날짜/저자 없음** → published_at fallback(ingest time).

## 인코딩/공통 처리

- 한자/일본어 numeric char ref 디코드(はてブ RDF), double-escaped HTML(요즘IT), cp932(ITmedia legacy).
- 본문은 sanitize(BBlog 의 rehype-sanitize 계열 활용) 후 저장.
- User-Agent: `Mozilla/5.0 (Macintosh)` 권장. CF 게이트는 UA 만으로 못 뚫리는 경우 있음(OpenAI).

## provider 인터페이스 초안 (4단계용)

각 소스 = 하나의 provider 객체:
```
{
  id, name, lang, kind: 'web' | 'vendor', vendor?,
  list: () => CrawledItem[]        // 피드/ API 에서 목록
  fetchBody?: (item) => string     // 전략별 본문 (feed-full 은 생략)
  strategy: 'feed-full' | 'api' | 'feed+article' | 'feed+md' | 'feed-only' | 'aggregator'
  bodySelector?, dedupKey, noiseFilter?
}
```
공통 러너가 strategy 로 분기 → 추후 소스 추가 시 provider 1개만 등록.
