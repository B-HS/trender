# 운영 지식 · 함정 (durable)

> ts-trender 운영/백필에서 반복 적용되는 사실·함정. 새 세션 시작 시 먼저 읽는다.
> 출처: 2026-06-24~29 토큰 성능분석 + 번역/리포트 백필 세션. 코드 근거는 `docs/history/2026-06-session.md`.

## DB / 마이그레이션

- **DB는 `db:push` 기반.** `__drizzle_migrations` 추적 테이블이 없다 → `bun db:migrate` 돌리면 0000부터 재적용 시도 → `table already exists`로 중단. **새 마이그레이션은 `bun db:push` 또는 생성된 `drizzle/000N.sql`을 직접 적용**한다. (0003 `app_locks`는 0003 SQL을 직접 실행해 넣었다.)
- DB는 **레거시 공유 DB**(`DATABASE_URL`). `reports` 행 **직접 DELETE는 auto-mode classifier가 차단**한다(사용자가 리포트 유실에 민감). 정리는 스크립트 내부 멱등 upsert(특정 키만 delete-then-insert)로, 직접 인라인 DELETE는 금지.

## 크롤 / 토큰 (이번 세션 핵심)

- **토큰·런타임 폭증의 진짜 원인은 "아카이브 백필 번역"이었다.** OpenAI 피드(1019개, 2015~), HuggingFace(808개, 2020~)가 **전체 아카이브를 노출** → 컷오프 없던 크롤러가 매 런 15건씩 옛날 글을 퍼와 전부 번역. (overlap/중복 URL이 아니라 distinct 옛 기사.)
- 대응 코드(전부 `vercel` 브랜치 푸시, vercel=프로덕션):
  - **크롤 14일 컷오프** (`lib/crawl/pipeline.ts` `MAX_AGE_DAYS=14`): `publishedAt` 14일↑ 옛 글은 insert·fetch 전에 skip. publishedAt 없는 건 유지.
  - **크론 중복 락** (`entities/lock/lock.repo.ts` + `app_locks` 테이블): crawlWorkflow 시작 시 `acquireLock('crawl', 90분 TTL)`, 못 얻으면 skip, finally release. `*/30`→`0 * * * *`(1시간).
  - **enrich 배치화** (`workflows/crawl.ts`): 건당 step(120) → 6건 배치 step(~20). enrichBatch 횟수는 crawlOne(22)과 무관, `남은 미번역/6`.
  - **enrich 2026 필터** (`entities/article/article.repo.ts` `listPendingArticleIds`): `coalesce(published_at, fetched_at) >= '2026-01-01'`만 enrich. 옛 아카이브는 enrich/번역 안 함.

## 번역 (Ollama Cloud 백필)

- 프로덕션은 codex(`CODEX_AUTH`)로 번역하지만, **codex rate limit 시 Ollama Cloud로 백필**한다. → `docs/utils/backfill/`.
- 모델: **번역 = `deepseek-v4-flash:cloud`**, **리포트 = `deepseek-v4-pro:cloud`** (사용자 지정). `https://ollama.com/api/chat`, `think:false`, 번역 `num_ctx:32768`, `AbortSignal.timeout(120000)`.
- **임시키는 폐기되면 401.** 키는 절대 파일/커밋에 안 넣고 env로만.
- 거대 본문(예: 20818자) 1건이 반복 타임아웃으로 미번역 남을 수 있음(허용, 재시도/codex로 처리).
- **번역 대상**: 비-ko + 본문 有 + `coalesce(published_at,fetched_at) >= 2026-01-01`. (ko는 키워드만, 번역 안 함.)

## 리포트

- **리포트 = 기사 요약.** 기사를 **`fetched_at` 윈도우**로 묶는다(발행일 아님). 일일 종료일 E → `[E-1, E)`, 주간 → `[E-7, E)`. 제목 `(E)`.
- **만들 수 있는 리포트는 기사 보유 기간에 묶인다.** 기사 `fetched_at` 하한(현재 **2026-05-16**) 이전은 기사 0 → 빈 리포트 불가. 총량 = 보유기간 × 8조합(일반 ko/ja/en + 벤더 ko 5, meta 제외).
- **`rank`는 MySQL 예약어** → `report_items` insert에 `` `rank` `` 백틱 필수. 안 하면 행만 생기고 items 실패 = orphan.
- **리포트 `created_at` = `period_end`로 보정**(일일 23:00, 주간 22:00). 백필 insert는 `created_at=now()`라 정렬이 다 오늘로 뭉치므로, 리포트 백필 직후 `fix-report-created.ts` 필수. `listReports`는 `createdAt desc` 정렬.
- **프로덕션 리포트가 짧던 원인**: `generateReport`가 `callCodex`를 effort 미지정(=low)로 호출 + 프롬프트가 분량 미강제. → 프롬프트 강화(토픽 3-4·각 2-3문단·기사 전부 커버·구체적) + `effort: 'medium'`로 고침(`lib/ai/report.ts`).
- 메인(`app/page.tsx`): 일반/기업 각 **6개**. `getDailyVendorReports(6)`.

## 정렬 (게시글 공통)

- **모든 게시글 정렬 = 생성일 desc.** 리포트=`created_at`(=period_end) desc. 기사·북마크=**`coalesce(published_at, fetched_at) desc, id desc`**(예전 `id desc`는 표시 발행일과 어긋나 날짜 섞임).
- 기사 무한스크롤 커서: `id`(number) → **복합 키셋 `"sortAt|id"`(string)**. 영향 파일: `entities/article/article.repo.ts`(listArticles), `article.action.ts`, `article.client.ts`, `app/article/page.tsx`, `app/vendor/[vendor]/page.tsx`, `app/api/articles/route.ts`. `ArticleListItem`에 `sortAt: string` 추가.

## 인프라 / 시크릿

- **Vercel Production Branch = `vercel`**(git 기본 `main` 아님). 크론은 Production에서만 돈다. `vercel` 푸시 → 프로덕션 배포. (`.vercel/project.json`엔 production branch 값 없음 → 셸에서 확인 불가.)
- 도는 Vercel 워크플로는 셸에서 못 멈춤 — 대시보드 Cancel / Cron 일시중지.
- **codex는 6/30까지 rate limit.** 그전까지 번역/리포트는 Ollama Cloud로.
- 커밋: author 단독(`Hyunseok Byun`), **Co-Authored-By/Claude 트레일러 절대 금지**, 요청 전 commit/push 금지, Conventional Commits.

## 리포트 대량 재생성 (2026-06-29, 상세 `docs/history/2026-06-29-report-depth.md`)
- **리포트 깊이 = 입력 본문 + 프롬프트**가 좌우. 제목만 넣으면 얇다. `report.ts`/`report.repo.ts`에 본문 발췌(`coalesce(content_translated_ko,content_original)`, 태그 제거, 16000자) + 강화 프롬프트 적용됨(모델 `gpt-5.4-mini` 유지).
- **병렬 백필 DB 함정**: mysql 풀 기본 `connectionLimit=10` × 병렬 에이전트(~16) = 연결 초과 → `PROTOCOL_CONNECTION_LOST`. 병렬 백필 풀은 **`connectionLimit:2`** + 청크 ≤12. 생성 실패해도 본문 파일(out-*.md)은 남으니 순차 `inline.ts save`로 살림.
- **공식 5h usage %** 는 statusline stdin JSON `rate_limits.five_hour.used_percentage`에만 있음(Pro/Max, 첫 API응답 후). `~/.claude/statusline-command.sh`가 `~/.ts-trender-cron/usage.txt`로 기록 → 자동 게이팅에 사용. ccusage는 토큰/비용만, 공식 % 없음. LLM 자신은 usage 모름.
- 도구: `docs/utils/backfill/inline.ts`(build/prompt/save, worklist 기반, 병렬 안전) + `Workflow`로 idx 청크당 sonnet 에이전트. report-backfill에 `ENGINE=claude`·`MODEL`·`KIND`·`MIN_END`·`EXISTING`·`num_ctx` 추가.
