# Next.js on Vercel Pro — 통합 타당성 (2026-06)

## 결론
brower 제거로 Python→TS 포팅이 열렸고, **Vercel Pro면 단일 Next.js 앱으로 통합 가능**. Hono·서드파티 워크플로 불필요. 긴 작업만 Vercel 1st-party **WDK** 선택 적용.

## Vercel 실행 모델 (확정)
- serverless freeze/suspend — **응답 보내면 인스턴스 동결.** naive fire-and-forget 불가. `waitUntil`은 가능하나 **함수 maxDuration 예산 공유**(별도 시간 없음).
- **maxDuration**: Fluid Compute GA로 **Pro 800s**, 함수별 **1800s(30분 beta, 특정 Node/Python 런타임)**. (Hobby는 300s 천장.)
- **Cron**: Pro는 **빈도 무제한**(Hobby는 1일 1회). cron 함수도 동일 maxDuration.

## Vercel WDK (`workflow-sdk.dev`)
- Vercel **1st-party 오픈소스**(public beta). `"use workflow"`/`"use step"`로 평범한 async TS를 durable하게: 상태 영속·자동 재시도·`sleep("7 days")`·타임아웃/배포 초월. Next.js 네이티브, Vercel에서 zero-config(큐·스토리지 불필요).
- 서드파티(Inngest/Trigger.dev/QStash) 대체 — 동일 문제를 1st-party로 해결.

## 워크로드 적합성 (Pro 800s 기준)
- 대부분 단계가 **이미 청크형**이라 단일 함수에 들어감: keywords 60/run(~100s), translate 60/run(~200s), report kind/lang당 단일 콜(<800s), collect per-source.
- **번역 백로그(~18h)**: 단일 불가 → 빈번 cron + 청크로 드레인(멱등 `translated_at IS NULL`), 또는 WDK self-loop+sleep.
- **report 다국어/벤더 팬아웃**: 평범 cron(lang/vendor당 1 invocation)으로 분할 가능. 오케스트레이션 깔끔하게 하려면 WDK.
- 결론: **핵심 경로는 평범한 Vercel Cron + Route Handler로 충분**, WDK는 긴/다단계만 보강.

## 통합 아키텍처
- 단일 Next.js 앱(`apps/web` 유지·확장) + `packages/db`(drizzle 재사용) + `packages/ui`.
- 파이프라인 = `lib/pipeline|fetch|llm` + `app/api/cron/<task>` + `vercel.json` crons. (+ 긴 작업 WDK.)
- **제약**: mysql2는 Node 런타임 강제(Edge 불가). 로컬 Ollama 없음(Cloud+Codex만). Codex 토큰은 DB/KV(영속 FS 없음). prod DB 공유 → 마이그레이션 수동 리뷰+승인.

## 출처
vercel.com/blog/introducing-workflow · workflow-sdk.dev · vercel.com/docs/cron-jobs/usage-and-pricing · vercel.com/docs/functions/configuring-functions/duration
