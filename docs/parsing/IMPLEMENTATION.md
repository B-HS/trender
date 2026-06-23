# 파싱 구현 구조 (step 4)

> 라이브 검증 완료(2026-06-23). provider 추상화로 소스 추가 = config 1줄.

## 파일

| 파일 | 역할 |
|------|------|
| `entities/source/provider.type.ts` | `Provider`/`RawListItem`/`CrawledItem`/`Strategy`/`Lang`/`Vendor` 타입 |
| `entities/source/registry.ts` | `PROVIDERS[]` 전체 등록 + `getProvider(id)` |
| `entities/source/providers/zenn.ts` | Zenn API provider (api 전략, body_html 2차 호출) |
| `entities/source/providers/qiita.ts` | Qiita API provider (api 전략, rendered_body inline, `stocks:>N`) |
| `lib/crawl/fetch.ts` | `fetchText`(UA + charset/cp932 자동 디코드)·`fetchJson` |
| `lib/crawl/feed.ts` | `parseFeed` — RSS2.0 / Atom / RDF 정규화 → `FeedEntry[]` |
| `lib/crawl/html.ts` | `extractBySelector`(최장 매치 본문 추출)·`htmlToText` |
| `lib/crawl/factories.ts` | 전략별 provider 팩토리 + `normalizeDate` |
| `lib/crawl/runner.ts` | `runProvider(provider, {limit, skipUrl})` — list→dedup→body |

## 전략별 팩토리

- `createFeedFullProvider` — 피드 본문(content:encoded/content/summary). Anthropic·요즘IT·MarkTechPost·Simon Willison·Raschka·Naver D2.
- `createArticleProvider({selectors})` — 피드 목록 + 기사 셀렉터(최장 매치). AITimes·ITmedia·Publickey·HuggingFace·DeepMind·Google Research·OpenAI.
- `createMdProvider({mdBase})` — GeekNews `/topic/{id}.md` (id 는 feed guid `?id=` 에서).
- `createThinFeedProvider` — KakaoTech(피드 요약만).
- `createAggregatorProvider({selectors})` — はてブ(외부 도메인, 실패 시 summary fallback).
- 커스텀 — Zenn·Qiita(api).

## 핵심 동작

- `feed+article`/`feed+md`/`aggregator` 는 `listForceBody` 로 피드 content 를 비워 **항상 전용 본문 fetch**.
- `extractBySelector` 는 후보 셀렉터 중 **텍스트 최장** 노드 선택(itmedia 처럼 stub 셀렉터 회피).
- `runProvider` 의 `skipUrl` 로 **이미 DB 에 있는 url 본문 fetch 생략**(step 7 증분 크롤에서 사용), `limit` 로 회당 상한.

## 라이브 검증 결과 (회당 body0 길이)

| id | strategy | items | body 길이 |
|----|----------|-------|-----------|
| zenn-ai | api | 48 | 8249 |
| qiita-ai | api | 20 | 13358 |
| anthropic | feed-full | 20 | 5966 |
| geeknews | feed+md | 50 | 7229 |
| aitimes | feed+article | 50 | 2321 |
| itmedia | feed+article | 20 | 18635 |
| publickey | feed+article | — | 4811 |
| deepmind | feed+article | — | 4036 |
| google-research | feed+article | — | 3148 |
| simon-willison | feed-full | 30 | 2981 |
| naver-d2 | feed-full | 20 | 1269 |
| kakaotech | feed-only | 10 | 258 (요약만) |

## 알려진 제약

- **OpenAI**: 기사 본문 CF 403(검증 환경) → article fetch 실패 시 summary fallback. Vercel egress 확인 필요.
- **HuggingFace**: 간헐 429(rate limit) → 재시도 필요(step 7 retry).
- **itmedia**: `.l-block__main` 는 관련기사 일부 포함 가능(최장매치). 충분히 본문 위주.
- **본문 포맷 혼재**: 대부분 HTML, GeekNews 는 markdown(.md). 렌더 단계에서 HTML/markdown 모두 처리 필요(step 9).
- **Meta**: provider 미등록(피드 확정 후 factory 1줄 추가).
