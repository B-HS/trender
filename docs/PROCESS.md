# PROCESS — ts-trender (AI Trend Bot)

> 작업 상태·체크리스트 단일 출처. 매 스텝 완료 시 갱신한다.

## 기준 문서

- 컨벤션: `~/.claude/convention/*.md` (FSD, arrow-fn, named export, 주석 금지, bun)
- 디자인 레퍼런스: `/Users/gkn/BBlog` (Next 16 / React 19 / React Compiler / Tailwind v4 / shadcn new-york / FSD)
- 소스 목록: `docs/sources.md`
- 파싱 방법: `docs/parsing/*.md`

## 합의된 결정 (2026-06-23)

- 패키지매니저/런타임: **bun** (설치/스크립트/런타임, 단위테스트 bun test, 빌드 next build)
- Meta AI 소스: **보류** — provider 자리만 stub, 피드 확정 시 추가
- AI 호출: **CODEX_AUTH(auth.json 직렬화)의 access_token 으로 ChatGPT backend responses API 직접 호출** (codex CLI 와 동일 OAuth). 모델: gpt-5.5(번역), gpt-5.4-mini(키워드)
- 1단계 검증: **전 소스 라이브 전수 검증** 후 문서화
- 기술스택: Vercel + Vercel Workflow SDK + Next.js + Drizzle + shadcn + BBlog 디자인
- DB: legacy `DATABASE_URL` → drizzle pull 로 구조 파악, 완전 지원 + 필요 컬럼 추가
- FE 메뉴: 리포트 / 기사 / 기업(벤더). 기업은 헤더+사이드바+본문(일일/주간 리포트 + 벤더별)
- 로그인: 유저이름만 입력 → 북마크용
- 반응형: mobile / tablet / pc. virtual scroll + go-to-top (BBlog 것 활용), globals.css 그대로 가져옴

## 체크리스트

- [x] 1. 사이트 파싱 방법 라이브 전수 검증 + 문서화 (`docs/parsing/`) — 21소스 검증 완료, README.md 개요. Meta 보류.
- [x] 2. drizzle pull 로 legacy DB 구조 파악 (`docs/db/legacy-schema.md`) — 9테이블. 추가 예정: sources.vendor, reports.vendor (둘 다 nullable enum). 일반/기업 데이터 vendor null 로 분리.
- [~] 3. 프로젝트 초기화 — Next16/React19/RC/Tailwind v4/shadcn(new-york) 셸 완료, `next build` 통과. BBlog globals.css·ui·virtual-scroll·go-to-top·providers 이식. FSD(app/entities/features/widgets/lib/ui) + alias. DB schema(entities/db) + 라이브 DB vendor 컬럼 적용(0001). **남음: Vercel Workflow SDK 설치(step 7에서)**.
- [x] 4. 파싱 로직 구현 — provider 추상화 완료(`entities/source` + `lib/crawl`). 21소스 등록, 6전략 라이브 검증. 소스 추가 = config 1줄. `docs/parsing/IMPLEMENTATION.md`.
- [x] 5. AI 기능 — codex 클라이언트(`lib/ai/codex.ts`) + 리포트 생성(`lib/ai/report.ts` daily/weekly, 일반+vendor) + 리포트 cron/workflow(`workflows/report.ts`, `/api/cron/report/[kind]`).
- [x] 6. 번역(`lib/ai/translate.ts` gpt-5.5)·키워드(`lib/ai/keywords.ts` gpt-5.4-mini) — 라이브 검증(자연스러운 한국어 번역 + JSON 키워드 배열).
- [x] 7. Vercel Workflow — `workflows/crawl.ts`('use workflow'/'use step'), `lib/crawl/pipeline.ts`(crawl→insert→enrich), cron `app/api/cron/crawl`(*/30), `vercel.json`. 라이브 검증(15기사 crawl + 번역/키워드 저장). codex 401시 refresh_token 갱신 추가. repos: `entities/source/source.repo.ts`·`entities/article/article.repo.ts`.
- [x] 8. 로그인(유저이름)+북마크 — `entities/auth`·`entities/favorite`, `/api/auth/*`·`/api/favorites`, 세션쿠키(`lib/auth/session.ts`), `AuthNav`+`BookmarkButton`+`/bookmarks`.
- [x] 9. FE — 홈(일반/기업 일일리포트, 로고→`/`), 기사(무한스크롤)+상세(번역본문/키워드/원문), 리포트 목록/상세(md 렌더), 기업(사이드바 일일·주간 리포트+벤더별 기사), 반응형, virtual scroll·go-to-top. `next build` 통과.

- [x] 10. 성능·토큰 최적화 + 번역/리포트 대량 백필 + FE 수정 (2026-06-24~29) — 아래 별도 섹션. 전체 narrative는 `docs/history/2026-06-session.md`, 운영 함정은 `docs/memory/ops-and-gotchas.md`, 백필 스크립트는 `docs/utils/backfill/`.

## 10. 성능·백필·FE 수정 (2026-06-24 ~ 06-29)

> 발단: crawlWorkflow가 2시간씩 돌고 토큰 과다. 진짜 원인 = OpenAI/HF 피드가 전체 아카이브 노출 → 컷오프 없는 크롤러가 옛 글을 매 런 번역(아카이브 백필). 상세: `docs/history/2026-06-session.md`.

코드(전부 `vercel` 브랜치 = 프로덕션, 푸시됨):
- `3209490` 크론 중복 락(`app_locks`+`entities/lock`) + enrich 배치화(`workflows/crawl.ts`) + crawl `*/30`→`0 * * * *`.
- `79df544` 크롤 14일 컷오프(`lib/crawl/pipeline.ts`).
- `511df89` enrich 2026 필터(`listPendingArticleIds`).
- `f4fea60` 게시글 정렬 `coalesce(published,fetched) desc` + 키셋 커서(string) + 메인 기업 6개.
- `051f036` 리포트 프롬프트 강화 + `effort: 'medium'`(`lib/ai/report.ts`).

DB(데이터, 미커밋): `app_locks` 추가(0003 SQL 직접 적용 — **db:push 기반이라 db:migrate 금지**). 비-ko 2026+ 번역 백필. 리포트 일일/주간 백필(영어 포함 8조합, 기사 `fetched_at` 윈도우). 리포트 `created_at = period_end` 보정.

백필 도구: `docs/utils/backfill/` (`translate-backfill.ts` flash, `report-backfill.ts` pro/codex, `fix-report-created.ts`). README에 실행법·파라미터·함정.

현재 상태(2026-06-29): 비-ko 미번역 잔여 1건(116905 거대본문 타임아웃). 리포트 일일 169/주간 36, 최신 6/29. **codex는 6/30까지 rate limit** → 그전까진 Ollama Cloud 백필로 보완.

## 11. 본문 오버플로/코드블록 + 검색 타임존 근본수정 (2026-07-01)

> 상세: `docs/history/2026-07-01-prose-overflow-and-tz-filter.md`. 함정: `docs/memory/ops-and-gotchas.md`(타임존 근본수정·prose·Turbopack).

- [x] 본문 가로 오버플로 수정 + BBlog 코드블록 스타일 CSS 이식(모바일 폰트 축소·줄바꿈·다크박스). `app/globals.css` `.prose` + `content-toggle`/`content-view` `min-w-0`. 커밋 `638450d` 푸시됨.
- [x] 검색 "기간/오늘" 타임존 근본수정 — 원인: aitimes 오프셋 없는 pubDate가 Vercel(UTC)에서 KST-wallclock 저장(+9h) + 쿼리의 published(UTC)/fetched(KST) 혼용.
  - A. `lib/crawl/factories.ts` `normalizeDate(raw, tz)` 결정론화 + provider `LANG_TZ` 전달.
  - C. `entities/article/article.repo.ts` `listArticles` `sortUtc` 단일 UTC 기준(정렬/커서/period), today `[하한,상한)`, 3d/7d `utc_timestamp()`.
  - B. 백필(DB, 미커밋): aitimes/d2.naver 오염 238행 `published_at -9h`(`gap<6h`, 멱등). 스크립트 `docs/utils/backfill/tz-published-fix.ts`.
  - 검증: 정렬 실제 시간순 interleave, today KST일 오탐 0, `tsc` 0.
- 미결: `app/api/articles/route.ts`는 dead code(client=서버액션)라 미수정.

## 12. 페이지별 수동 캐시 revalidate 버튼 (2026-07-02)

> 상세: `docs/history/2026-07-02-per-page-revalidate-button.md`. Next 캐시 API 함정: `docs/memory/ops-and-gotchas.md`.

- [x] DB 확인 — 7월 1일 기사(`fetched_at` 280 / `published_at` 202)·리포트(07-01 08시 생성 7건, id 751~757) 정상 존재. 노출 지연 = Next.js 캐시.
- [x] 각 페이지에 수동 revalidate 버튼 추가 — 커밋 `5010c21` 푸시됨.
  - `lib/revalidate.action.ts`(`'use server'`): `updateTag`(Next 16, 서버액션 read-your-own-writes) + `revalidatePath`.
  - `features/common/revalidate-button.tsx`(클릭→액션→`router.refresh()`→toast) + `features/common/page-header.tsx`(리스트 4곳 헤더 공통화).
  - 배치 7곳: 홈/기사목록(`articles`)/기사상세/리포트목록(`reports`)/리포트상세/벤더기사(`articles`)/벤더리포트. `/bookmarks`(force-dynamic)·`/vendor`(redirect) 제외.
  - 검증: `tsc` 0 · `next build` 통과 · 프로덕션 7페이지 200+버튼 · 적대적 리뷰 correctness 0.
- [x] 리포트 크론 시각 변경(`vercel.json`) — Vercel 크론은 UTC. daily `0 23`→**`0 20`**(KST 08→05시), weekly `0 22 * * 0`→**`0 16 * * 0`**(KST 월 07→01시).
- [x] 오늘 daily 리포트 수동 생성 — period 06-30→07-01 **6건**(758~763, general ko/ja/en + openai/anthropic/google). naver/kakao는 윈도우 내 기사 0건이라 스킵(정상). DB 데이터라 미커밋.

## 검증 필요 시점

- 각 구현 단위마다 사용자에게 테스트 요청 (테스트는 사용자가 직접 수행)
- 커밋/푸시는 사용자 명시 요청 시에만
