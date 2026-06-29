# 세션 기록 — 토큰 성능분석 + 번역/리포트 백필 (2026-06-24 ~ 06-29)

> 발단: "Vercel workflow가 2시간씩 돌고 한 번에 토큰을 무진장 먹는다"는 문제 분석에서 시작 → 크롤/토큰 최적화 → 번역·리포트 대량 백필 → FE 정렬/메인/리포트 품질 수정까지. 새 세션 인계용 전체 기록.
> 운영 규칙·함정은 `docs/memory/ops-and-gotchas.md`, 백필 스크립트는 `docs/utils/backfill/`.

## 1. 토큰·런타임 폭증 분석

증상: crawlWorkflow가 2시간씩, 토큰 과다.
- **런타임**: enrich 직렬 배치(120건/run, 6동시 20배치) × 느린 codex + step 143개 오버헤드 + 크롤 fetch 타임아웃 부재 + **크론 중복(락 없음, `*/30`이라 2h면 4개 겹침)**.
- **토큰(진짜 주범)**: 실측 결과 OpenAI(8h 255건)·HuggingFace(8h 255건)가 **전부 2022~2024 옛 아카이브**. 피드가 전체 히스토리(OpenAI 1019개/2015~, HF 808개/2020~)를 노출 → 컷오프 없는 크롤러가 매 런 15건씩 옛 글을 퍼와 **16k자 본문 전체 번역**. (overlap 아님 — URL distinct.)

## 2. 크론 중복 락 + 배치 + 1시간  → 커밋 `3209490`

- `app_locks` 테이블(0003 마이그레이션, **db:push 기반이라 0003 SQL 직접 적용**) + `entities/lock/lock.repo.ts`(원자적 acquire/release, TTL 90분).
- `workflows/crawl.ts`: 시작 시 락 획득→실패 skip, finally release. enrich 건당 step(120)→**배치 step(6건/스텝, ~20)**.
- `vercel.json` crawl `*/30`→`0 * * * *`.
- 라이브 검증: 락 원자성(자유→true, 점유→false, 해제→true).

## 3. 14일 컷오프  → 커밋 `79df544`

- `lib/crawl/pipeline.ts`: `MAX_AGE_DAYS=14`, `publishedAt` 14일↑ 옛 글은 dedup·fetch·insert 전 skip(publishedAt 없으면 유지). OpenAI/HF 아카이브 백필 차단.

## 4. 번역 백필 (Ollama Cloud) — 2277건

- codex 토큰 절약 위해 **Ollama Cloud `deepseek-v4-flash:cloud`**로 비-ko 미번역 본문 대량 번역. `docs/utils/backfill/translate-backfill.ts`.
- 1분 진행 보고를 위해 `/loop`(cron `*/1`)로 ETA 포함 모니터링.
- 중간 함정: 파일 리다이렉트 시 stdout 블록버퍼링(로그 지연 ≠ 정지), fetch 타임아웃 없어 워커 묶임 → `AbortSignal.timeout(120000)` 추가 후 재시작.
- 완료: 2277건 번역, 발행연도 2022~2026 분포(아카이브 포함). 남은 미번역은 전부 2026 발행분이었음.

## 5. enrich 2026 필터  → 커밋 `511df89`

- 사용자 지시: "번역은 무조건 2026년 1월부터." `entities/article/article.repo.ts` `listPendingArticleIds`에 `coalesce(published_at, fetched_at) >= '2026-01-01'` 필터. 백필 스크립트도 동일.

## 6. 리포트 백필 (deepseek-v4-pro)

- `docs/utils/backfill/report-backfill.ts`. 조합 8개(일반 ko/ja/en + 벤더 ko 5).
- 리포트는 기사를 **`fetched_at` 윈도우**로 묶음(상한 `< periodEnd` 직접 추가 — 프로덕션 `getArticlesForPeriod`엔 상한 없음).
- **`rank` 예약어 사고**: 백틱 누락으로 `report_items` insert 실패 → 행만 생기고 items 없는 **orphan 32건** 양산. `` `rank` `` 백틱 + `reportExists`를 "items 있는 완성본만 skip"으로 고쳐 orphan만 재생성(원본 16건 보존, DELETE 없이).
- 범위 확장: 일간 10→30→50일, 주간 6→18→30주, 영어 포함. 데이터 천장 도달 — 기사 `fetched_at` 하한 **5/16**이라 그 이전은 빈 리포트. 최종 6/24 시점 171건.

## 7. 리포트 created_at 보정

- 백필 insert는 `created_at=now()`라 정렬이 다 오늘로 뭉침 → **`created_at = period_end`**(일일 23:00, 주간 22:00)로 보정(`fix-report-created.ts`). 리포트 백필 직후 항상 실행.

## 8. 게시글 정렬 + 메인 6개  → 커밋 `f4fea60`

- 기사 탭 날짜(24/22) 섞임: `listArticles`/북마크 정렬 `id desc` → **`coalesce(published_at, fetched_at) desc, id desc`**.
- 무한스크롤 커서 `id`(number) → **복합 키셋 `"sortAt|id"`(string)**. `ArticleListItem`에 `sortAt` 추가. 영향: article.repo/action/client, app/article·vendor page, api/articles route, favorite.repo.
- 메인 기업 리포트 8→**6** (`app/page.tsx`).

## 9. 리포트 품질  → 커밋 `051f036`

- "리포트 짤린듯" 점검 → **잘림 아님**(정밀 확인 잘림 0). codex 프로덕션 리포트가 짧던 것(평균 1980자 vs Ollama 백필 3529자).
- 원인: `generateReport`가 codex effort 미지정(=low) + 프롬프트 분량 미강제.
- 수정(`lib/ai/report.ts`): 프롬프트 강화(토픽 3-4·각 2-3문단·기사 전부 커버·구체적) + 리포트 한정 **`effort: 'medium'`**.
- 기존 6/24 16건은 Ollama 키 401(폐기) → **codex(`ENGINE=codex`, FORCE)로 재생성** → 1980자→3427~6870자.

## 10. 새 세션(2026-06-29): codex limit → Ollama 재가동

- codex가 **6/30까지 rate limit** → 그전까지 Ollama Cloud로(번역=flash, 리포트=pro). 새 임시키.
- scratchpad가 며칠 사이 정리돼 `translate-backfill.ts`/`fix-report-created.ts` 소실 → 재작성(이번에 `docs/utils/backfill/`로 영구 보존).
- 6/25~6/29 누적 미번역 **223건 번역**(226 완료, 거대 본문 1건 116905 타임아웃 미번역 잔류).
- 리포트 누락분(일간 6/27~6/29 + 현재주 6/22~6/29) 생성 → 일일 169건/최신 6/29, 주간 36건/최신 6/29. created_at 보정.

## 현재 상태 (2026-06-29 기준)

- 코드(`vercel` 푸시, 프로덕션 반영): 락·배치·14일컷오프·enrich 2026필터·기사 정렬·리포트 프롬프트/effort. 커밋 `3209490`→`79df544`→`511df89`→`f4fea60`→`051f036`.
- DB: `app_locks` 추가. 비-ko 미번역 잔여 1건(116905). 리포트 일일 169/주간 36, created_at=period_end, orphan 0.
- **codex 복귀(6/30) 후**: 프로덕션 cron이 정상 번역/리포트 재개. 그 사이는 필요 시 `docs/utils/backfill/`로 수동 보완.
- 미완: 116905 번역(거대 본문 타임아웃), Vercel 대시보드 cron/run 상태는 사용자 확인.
