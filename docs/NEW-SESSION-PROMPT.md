# 새 세션 킥오프 프롬프트 (복사용)

아래 블록을 새 세션 첫 메시지로 붙여넣으면 직전 세션을 100% 이어받는다.

---

trender 프로젝트를 이어서 작업한다. 직전 세션(2026-06)에서 "Python 파서 + Next.js 웹 + Docker cron"을 **단일 Next.js 앱(Vercel Pro)으로 통합**하기로 확정했고, 근거·결정·플랜을 `docs/`에 전부 정리해 뒀다.

먼저 이 순서로 정독해서 맥락을 100% 복원해라(요약하지 말고 실제로 읽어라):
1. `docs/README.md` (인덱스)
2. `docs/MIGRATION-PLAN.md` (자립형 통합 플랜 — 왜·결정·아키텍처·스키마·Phase 체크리스트)
3. `docs/PROCESS.md` (현재 진행 상태 + 체크리스트)
4. `docs/sources.md` (최종 소스 + 벤더 매핑 정본)
5. `docs/acknowledge/session-2026-06-nextjs-migration.md` (결정 트레일 + **재제안 금지**)
6. `docs/research/*` (CF 감사 / 소스·API 실측 / 브라우저 제거·추출 / **codex-chatgpt-protocol(TS 포팅 정본)** / vercel-nextjs-feasibility)

핵심 사실:
- 작업 브랜치 = **`ts-only`** (현재 dev의 Python/Docker 컨테이너는 컷오버까지 **무중단 유지** — 건드리지 말 것).
- 전역 룰(`~/.claude/CLAUDE.md` + `~/.claude/convention/*` + `~/personal-llm/*`) 준수: arrow fn, 주석 금지(JSDoc만), any/unknown 금지, named export, FSD 의존 방향, React Compiler(useMemo/useCallback 금지), **요청 전 commit/push 금지**, 커밋 author 단독·co-author 트레일러 금지, 시크릿은 env/KV로만.
- prod DB 공유 → drizzle 마이그레이션은 수동 리뷰 + 사용자 승인 후 적용.
- **API 우선 원칙**: 가져올 수 있으면 API가 베스트, 단 채택 전 항상 403/거부 먼저 테스트.
- 직전 작업: Codex(ChatGPT) OAuth provider 구현·라이브 검증 완료(커밋 `565eef6`). docs/는 미커밋 상태.

다음 할 일: **Phase 1 — 추출 품질 스파이크**부터. 실제 소스 기사로 `@mozilla/readability`(+JSON-LD) vs 현 Python trafilatura의 추출 텍스트 길이를 정량 비교해서 readability 채택 가부를 먼저 검증해라(포팅 #1 리스크). 그 다음 `vercel.json` cron 스텁 + 파이프라인 1개(collect/keywords) TS 슬라이스로 drizzle write를 검증한다.

정독 끝나면 (1) 복원한 맥락 요약 + (2) Phase 1 첫 스텝 제안을 1줄 객관식으로 확인하고 시작해라. 모호하면 추측 말고 물어라.

---
