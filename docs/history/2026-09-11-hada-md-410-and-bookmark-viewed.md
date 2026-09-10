# GeekNews 본문 410 복구 + 북마크·열람 로직 보강 (2026-09-11)

발단: GeekNews 기사 본문이 안 읽힌다는 보고. "CSR 전환" 의심 → 라이브 검증 결과 **CSR 아님**. 진짜 원인은 provider가 쓰던 **`.md` 엔드포인트의 영구 폐지**.

---

## 1. 진단 (라이브 curl/bun 검증)

- `GET https://news.hada.io/topic/{id}.md` → **`410 Gone`** `"GeekNews topic Markdown is no longer available. Use the original topic page instead."`
- `createMdProvider.fetchBody`가 throw → `runner.ts`의 try/catch가 **Atom 피드 `<content>`(~100자 요약)로 폴백** → 본문이 얇게 저장됨.
- 상세 페이지 `topic?id={id}`는 여전히 **SSR** — 본문 컨테이너 `section#topic_contents`(`class='article-content'`, `itemprop='articleBody'`)에 전문 HTML. cheerio 추출 9.5KB+ 확인(id 33453).
- **UA gate**: 브라우저 UA 없으면 상세/피드 모두 `403`(bare node/curl). `lib/crawl/fetch.ts`의 Chrome UA 헤더로 200 확인 — 기존 헤더로 충분.
- RSS `/rss/news`(Atom) 정상. 피드 `<link rel=alternate href>`가 곧 `topic?id=` URL이라 `createArticleProvider`가 그대로 재사용 가능.

## 2. 코드 변경

- **provider**: geeknews를 `createMdProvider` → `createArticleProvider(selectors:['#topic_contents','[itemprop="articleBody"]'])`로 전환. 죽은 `createMdProvider` 팩토리와 `'feed+md'` strategy 제거. 댓글(`#comment_thread`)은 컨테이너 밖이라 자동 제외.
- **열람**: `/api/views` POST 미인증 시 `{ok:false}` 200 → **401**. `useMarkViewed`에 `res.ok` 검사 + 실패 시 낙관적 상태 롤백(기존엔 서버 실패해도 영구 '읽음'으로 남는 버그). `markArticleViewed` upsert가 재열람 시 `viewedAt` 갱신.
- **북마크**: `useToggleFavorite` 낙관적 토글 + 롤백(기존 매번 refetch). `/api/favorites` GET `targetType` zod 검증. `features/article/bookmarks-list.tsx` 신규 — `/bookmarks`에서 북마크 해제 시 `useFavoriteIds` 낙관적 캐시에 반응해 **카드 즉시 제거**(실패 시 복원).
- **문서**: `docs/parsing/geeknews.md`·`README.md`·`sources.md`를 410 사실 + `#topic_contents` 전략으로 갱신.

## 3. 검증

- 라이브 스모크: geeknews `runProvider` 3건 중 2건 2.2~2.8KB 전문 확보(1건 514자는 원글 자체가 짧은 외부링크 큐레이션 — 컨테이너 전체 확보 확인, 파싱 정상).
- `bun test` 9/9 · `tsc --noEmit` 0 · prettier 통과. `next build`는 컴파일/TS 통과 후 prerender에서 로컬 MySQL 부재(`ECONNREFUSED :3306`)로 중단 — 환경 제약, 변경과 무관.
- `db:push` 불필요 — schema.ts 무변경, `favorites`·`article_views` 테이블 기존 존재.
- 백필 미실행: 이미 얇게 ingest된 기존 geeknews 행은 대상 아님. 필요 시 `docs/utils/backfill/` 패턴 스크립트.
