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

## 검증 필요 시점

- 각 구현 단위마다 사용자에게 테스트 요청 (테스트는 사용자가 직접 수행)
- 커밋/푸시는 사용자 명시 요청 시에만
