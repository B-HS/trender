# 리포트 깊이 개선 + 전량 재생성 (2026-06-29)

## 발단
FE의 일일/주간 트렌드 리포트 본문이 매우 얇다는 지적.

## 원인 (진단)
1. **입력이 제목만**: `getArticlesForPeriod`가 `id,title,url`만 select → 모델에 제목 리스트만 전달. 본문/요약 없음 → 깊이 구조적 한계.
2. **모델 `gpt-5.4-mini`**: `report.ts`가 `getEnv().TRANSLATE_MODEL` 사용(기본 mini). mini라 짧게, 특히 한국어/일본어가 영어보다 terse(데이터: 같은 30기사 en 7.7k~9.6k vs ko 3.3k~5.7k).
3. 벤더 일일은 기사 1~2건뿐(데이터 희소) → 불가피하게 짧음.
4. 출력 토큰 상한은 없음(잘림 아님).

## 조치 (모델 변경 없이)
- **입력에 본문 추가**: `coalesce(content_translated_ko, content_original)`를 HTML/MD 태그 제거 후 `BODY_CHARS=16000`까지 발췌해 `제목 + 본문` 형태로 전달.
- **프롬프트 강화**: 4–6개 트렌드, 섹션당 3문단+, 본문 수치/모델명/벤치마크 인용 강제, "언어 무관 동일 분량(한국어를 영어보다 짧게 쓰지 말 것)", ~1000–1400단어 + 종합 단락.
- 적용처: 프로덕션 `lib/ai/report.ts` + `entities/report/report.repo.ts`(workflow가 이후 자연히 깊은 리포트 생성, 모델 유지). 백필 `docs/utils/backfill/report-backfill.ts`도 동일.

## 전량 재생성 (기존 205건)
- 엔진 변천: codex rate-limit → Ollama pro(67건) → Ollama 쿼터 소진(429) → **claude headless(18건)** → **현재 세션 + 병렬 워크플로(sonnet, 122건)**로 확정.
- 도구: `docs/utils/backfill/inline.ts` — `build`(남은 작업=기존 reports MINUS 로그 OK), `prompt <idx>`(기사+지시 프롬프트 파일), `save <idx> <md>`(DB insert + created_at=period_end + 로그 append, **worklist 비변경=병렬 안전**).
- 오케스트레이션: `Workflow`로 idx 청크당 sonnet 에이전트 1개(각자 prompt→작성→save). 하니스 동시 상한 ~16.
- **usage 게이팅**: statusline이 받는 `rate_limits.five_hour.used_percentage`를 `~/.claude/statusline-command.sh`에서 `~/.ts-trender-cron/usage.txt`로 기록 → 청크마다 읽어 **70% 도달 시 정지**. 19%→68%로 전량 완료(70% 이내).

## 결과
- 122건 재생성 완료(worklist 0 pending). daily 168/weekly 36, 평균 본문 daily 7,564 / weekly 8,219자.
- 빈 기간 orphan(daily/ko/google 6/25, 기사 0) 삭제. thin-pro 1건(daily/ko/gen 5/27) 재생성(2,731→5,847). 짧은 2건은 기사 1~2개 정상.
- created_at 불일치 0, orphan 0.

## 함정/교훈
- **mysql 풀 connectionLimit 기본 10 × 병렬 에이전트 = DB 연결 초과**(청크4에서 24에이전트 → `PROTOCOL_CONNECTION_LOST` 10건). → `inline.ts` 풀을 `connectionLimit:2`로 낮추고 청크 ≤12로 축소해 해결. 실패해도 본문 파일(out-*.md)은 작성돼 순차 save로 살림.
- claude headless(`claude -p`)는 호출당 시스템프롬프트/툴 컨텍스트 재적재로 usage 비효율. 또 인라인이라도 **지배 비용은 기사 본문(건당 ~84k 토큰)** — inline/headless 차이는 부차적. usage 레버는 모델·BODY_CHARS·기사수.
- 공식 5h % 는 statusline stdin JSON에만 노출(`rate_limits.five_hour.used_percentage`, Pro/Max·첫 API 응답 후). ccusage는 토큰/비용만, 공식 %는 안 줌.

## 미커밋 (요청 시 커밋)
- `lib/ai/report.ts`, `entities/report/report.repo.ts` (프로덕션 깊이 개선).
- `docs/utils/backfill/report-backfill.ts`(MODEL/ENGINE=claude/KIND/MIN_END/EXISTING/num_ctx), `docs/utils/backfill/inline.ts`(신규).
