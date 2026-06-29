# 백필 스크립트 (translation / report)

> Vercel 프로덕션 cron(codex)이 막혔거나(rate limit) 과거치를 채워야 할 때, **Ollama Cloud(또는 codex)** 로 직접 번역·리포트를 채우는 1회성 스크립트.
> 원래 세션 임시폴더(scratchpad)에 있었으나 며칠 뒤 자동 정리돼 사라진 적이 있어, **여기 영구 보존**한다. 새 세션에서 그대로 실행 가능.

## 파일

| 파일 | 용도 | 모델/엔진 |
|------|------|-----------|
| `translate-backfill.ts` | 비-ko 기사 번역+키워드(2026+만) | Ollama `deepseek-v4-flash:cloud` |
| `report-backfill.ts` | 일일/주간 리포트 생성(영어 포함 8조합) | Ollama `deepseek-v4-pro:cloud` (기본) / `ENGINE=codex` 시 프로덕션 codex |
| `fix-report-created.ts` | 리포트 `created_at` 을 `period_end` 로 보정 | DB UPDATE만 |

## 실행 (repo 루트에서)

`bun` 이 `.env` 의 `DATABASE_URL` 을 자동 로드한다. `OLLAMA_KEY` 는 **임시키라 파일에 안 박고 env로만** 넘긴다(다 쓰면 폐기).

```bash
# 1) 번역 백필 (2026+ 미번역 비-ko 전부, flash)
OLLAMA_KEY='<temp>' CONC=3 bun docs/utils/backfill/translate-backfill.ts

# 2) 리포트 백필 — DRY로 대상 먼저 확인 (AI·INSERT 없음)
OLLAMA_KEY='<temp>' DRY=1 BASE=2026-06-29 DAILY_DAYS=50 WEEKLY_WEEKS=30 bun docs/utils/backfill/report-backfill.ts

# 3) 리포트 백필 실제 (pro, Ollama)
OLLAMA_KEY='<temp>' CONC=3 BASE=2026-06-29 DAILY_DAYS=10 WEEKLY_WEEKS=1 bun docs/utils/backfill/report-backfill.ts

# 3') codex로 생성/재생성 (프로덕션 엔진, CODEX_AUTH 필요, OLLAMA_KEY는 더미라도 필요)
OLLAMA_KEY='x' ENGINE=codex FORCE=1 BASE=2026-06-24 DAILY_DAYS=1 WEEKLY_WEEKS=1 bun docs/utils/backfill/report-backfill.ts

# 4) 리포트 생성 후 created_at 보정 (백필은 created_at=now로 들어가므로 필수)
bun docs/utils/backfill/fix-report-created.ts
```

## 파라미터 (env)

| env | 기본 | 의미 |
|-----|------|------|
| `OLLAMA_KEY` | (필수) | Ollama Cloud Bearer 키. `report-backfill`에서 `ENGINE=codex`면 더미라도 있어야 함(코드가 require). |
| `CONC` | 3 | 동시 호출 수 (Ollama Pro 플랜 ~3 동시) |
| `BASE` | `2026-06-24`(report만) | 리포트 종료일 기준 날짜(=오늘로 줘야 최신까지). `translate`엔 없음 |
| `DAILY_DAYS` | 10 | 일일 리포트 종료일 개수(오늘부터 역순). 0이면 일일 생략 |
| `WEEKLY_WEEKS` | 6 | 주간 리포트 종료일 개수(7일 간격). 0이면 주간 생략 |
| `DRY` | - | `1`이면 대상/기사수만 출력, AI·INSERT 안 함 |
| `FORCE` | - | `1`이면 `reportExists` skip 무시 → 기존 리포트도 재생성(delete-then-insert) |
| `ENGINE` | `ollama` | `codex`면 프로덕션 codex(`callCodex`, effort medium)로 생성 |
| `MAX` | ∞(translate만) | 번역 최대 건수(테스트용) |

## 동작 규칙 / 함정 (중요)

- **번역 대상 = `lang<>'ko'` AND 본문 있음 AND `coalesce(published_at, fetched_at) >= '2026-01-01'`.** (워크플로 `listPendingArticleIds`도 동일 2026 필터) — 옛 아카이브(2015~2025) 번역 안 함.
- **리포트는 기사를 `fetched_at` 윈도우로 묶는다**: 일일 종료일 E → 기간 `[E-1, E)`(= 달력 E-1일), 제목 `(E)`. 주간 E → `[E-7, E)`. 발행일과 무관.
  - 프로덕션 `getArticlesForPeriod`는 상한이 없으나(=항상 최근 30건), 이 스크립트는 **상한(`< periodEnd`)을 직접 넣어** 과거 기간을 정확히 자른다.
- **`reportExists`는 items가 있는 완성 리포트만 skip.** items 없는 orphan은 재생성됨.
- **`rank` 는 MySQL 예약어 → `` `rank` `` 백틱 필수.** (`report_items` insert). 안 하면 행만 생기고 items 실패 → orphan 양산(과거 32건 사고).
- **리포트 created_at**: 백필 insert는 `created_at=now()`. 정렬 일관성을 위해 **`created_at = period_end`**(일일 23:00, 주간 22:00)로 보정해야 함 → `fix-report-created.ts`를 리포트 백필 직후 항상 실행.
- **조합 8개**: 일반 `ko`/`ja`/`en` + 벤더 `ko`(openai/anthropic/google/naver/kakao). meta 제외(소스 보류).
- **데이터 천장**: 기사 `fetched_at` 하한(현재 2026-05-16)보다 과거 기간은 기사 0 → 빈 리포트 못 만듦(자동 skip). 리포트 총량 = (보유 기간) × 8조합 이 한계.
- **Ollama 호출**: `https://ollama.com/api/chat`, `think:false`, 번역은 `options.num_ctx:32768`(긴 본문 잘림 방지), `AbortSignal.timeout(120000)`(무한대기 방지). **키 폐기/만료 시 401 Unauthorized** → 새 키 필요.
- **`report-backfill.ts:12` 의 codex import 절대경로** `/Users/gkn/ts-trender/lib/ai/codex.ts` — 레포 경로가 다르면 수정.
- 스크립트는 키를 **env로만** 받고 파일에 저장 안 함. 커밋해도 시크릿 없음.
