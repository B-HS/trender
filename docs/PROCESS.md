# PROCESS — 리포트 고도화 · 인용 링크 · 멀티모델 · 기사 번역

> 베이스 룰: 루트 `CLAUDE.md` + `~/.claude/convention/*` + `~/personal-llm/*`.
> 모든 작업 상태는 이 문서에서 추적한다.

## 배경 / 결정 (사용자 확정)

- **모델 분리(2종)**: 리포트(요약) = 무거운 모델 `deepseek-v4-flash:cloud`, 키워드 추출 + 번역 = 가벼운 모델 `gemma4:31b-cloud`. 둘 다 `ollama_cloud`.
- **입력 캡 상향(중간)**: 리포트 입력 본문 개당 2,000→6,000자, 전체 50,000→200,000자.
- **번역**: 온디맨드 버튼이 아니라 **수집 시점에 같이 번역**해 DB 저장. 대상은 **한국어로만**(ja/en→ko). 프론트는 `[원문]/[번역글]` 토글만.
- "기사가 너무 많이 요약된다" 원인 = 원문은 풀텍스트 저장이지만 `report.py`가 LLM 투입 전 2,000/50,000자로 잘라서였음 → 캡 상향으로 해소.

## 핵심 제약

- `articles.content_original`은 **HTML**(trafilatura). → 번역본도 HTML로 저장해 동일 렌더 경로 사용.
- `components/article-html.tsx`는 `server-only`. → 클라 토글은 **서버에서 sanitize한 HTML 문자열**을 props로 받아 렌더.
- 파서(Python)는 마이그레이션 도구 없이 raw SQL + `SELECT *`. 스키마는 `packages/db`(drizzle)가 단일 출처. 신규 컬럼은 drizzle 마이그레이션으로 추가 후 적용해야 파서가 읽고 씀.

---

## 체크리스트

### Phase 1 — 리포트 품질(3종 세트) + 멀티모델
- [x] a. `config.py`: provider별 `*_model_light` 필드 추가 (번역/키워드용 경량 모델)
- [x] b. `llm/chain.py`: `ChainRole`("report"|"light") + `build_chain(role)` 추가, `build_default_chain`은 report로 위임
- [x] c. `pipeline/extract_keywords.py`: `build_chain("light")` 사용
- [x] d. `pipeline/report.py`: 캡 6,000 / 200,000 상향 + 분량·심층 지시 강화 (report role 유지)
- [x] e. `.env`: `OLLAMA_CLOUD_MODEL=deepseek-v4-flash:cloud`, `OLLAMA_CLOUD_MODEL_LIGHT=gemma4:31b-cloud`

### Phase 2 — 인용 `[#N]` 클릭 시 기사로 이동 (웹)
- [x] f. `reports/[id]/page.tsx`: rank→articleId 맵으로 `[#N]`을 `[#N](/articles/{id})`로 치환 후 `<Markdown>`에 전달

### Phase 3 — 번역 파이프라인 (파서 + DB)
- [x] g. `packages/db/src/schema.ts`: `articles`에 `title_translated_ko`, `content_translated_ko`, `translated_at` 추가
- [x] h. drizzle 마이그레이션 생성 (`bun run generate`) — **DB 적용은 사용자 확인 후**
- [x] i. `db/models.py`: `Article`에 번역 필드 추가
- [x] j. `db/repositories.py`: `fetch_articles_missing_translation`, `update_article_translation` 추가
- [x] k. `llm/base.py`: 한국어 번역 시스템 프롬프트 추가
- [x] l. `pipeline/translate.py`: 신규 (`translate_pending` — ja/en & translated_at IS NULL 대상, light 체인)
- [x] m. `main.py`: `translate` task 추가 + `all` 흐름에 편입
- [x] n. `pipeline/catchup.py`: translate 단계 편입

### Phase 4 — 웹 번역 토글
- [x] o. `lib/prose.ts`(공유 className) + `lib/sanitize.ts`(server-only sanitize 유틸)로 분리, `article-html.tsx` 리팩토링
- [x] p. `components/article-body.tsx`: 'use client' 토글 (원문/번역글), sanitize된 HTML 문자열 수신
- [x] q. `articles/[id]/page.tsx`: 번역 컬럼 select + sanitize + `ArticleBody` 렌더

### 검증 / 적용
- [x] r. 웹 typecheck (기존 drizzle 중복설치 에러만 존재, 신규 코드 0건) + 파서 import OK
- [x] s. DB 마이그레이션 적용 — `drizzle-kit migrate`는 journal이 없는 0000 SQL을 찾아 실패 → 운영 DB에 3개 ALTER ADD 직접 적용 완료(컬럼 확인됨)
- [x] t. deepseek 리포트 1건 생성(report_id=83): **13,312자** vs 기존 gemma ~4,200자 → 약 3.2배, 인용 46개. 모델명 정상
- [x] u. 테스트 작성: pytest 38개(chain/translate/report/extract_keywords/models) + bun:test 7개(citations) = 45개 전부 통과

## 결과 요약
- 3종 세트 효과 확인됨(리포트 3배+, 더 상세). 인용 링크/번역 토글 구현 완료.
- 번역 검증: 5건 ja→ko 번역 성공(HTML 태그 보존, 자연스러운 한국어).
- **번역 정책 확정(사용자)**: 백로그(약 2,200건) 백필 안 함 → 2,194건 스킵 처리(translated_at 스탬프), **새 기사만** 번역. 번역 없는 비한국어 기사는 "(번역 없음)" 표시. 상세 `docs/acknowledge/translation-policy.md`.
- drizzle `generate` 정상화 확인("No schema changes"). `migrate`는 journal의 0000 SQL 누락으로 미동작(운영은 수동 SQL 체제). 상세 `docs/acknowledge/drizzle-snapshot-drift.md`.
- drizzle 중복설치 해결: db가 drizzle 연산자를 재-export(`orm.ts`), web은 `@workspace/db`로만 import + web의 `drizzle-orm` 직접 의존 제거 → 단일 인스턴스. 전체 typecheck 통과(web/db/ui).

## 배포 (Docker)
- 실제 파서는 `docker/compose.yml`의 `parser` 컨테이너에서 **cron**으로 구동. env는 `docker/.env.local`(gitignore)에서 로드.
- cron 자식은 컨테이너 env를 못 받아 `entrypoint.sh`가 **화이트리스트 변수만** `/etc/trender.env`로 덤프 → 신규 `*_MODEL_LIGHT`를 화이트리스트에 추가함(누락 시 keyword/translate가 light 모델 못 받고 report 모델로 폴백).
- `docker/.env.local` 반영 완료: `OLLAMA_CLOUD_MODEL=deepseek-v4-flash:cloud`, `OLLAMA_CLOUD_MODEL_LIGHT=gemma4:31b-cloud`.
- 코드/entrypoint는 이미지에 COPY되므로 **재빌드 필요**: `cd docker && docker compose up -d --build`.
