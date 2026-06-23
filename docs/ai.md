# AI 레이어 (codex-oauth)

> 라이브 검증 완료(2026-06-23). `CODEX_AUTH`(.env) = codex auth.json 직렬화.

## CODEX_AUTH 구조

```
{ auth_mode, OPENAI_API_KEY(null), tokens: { id_token, access_token, refresh_token, account_id }, last_refresh }
```

ChatGPT OAuth 모드(OPENAI_API_KEY null) → ChatGPT backend Responses API 사용.

## 호출 (`lib/ai/codex.ts`)

- 엔드포인트: `POST https://chatgpt.com/backend-api/codex/responses`
- 헤더: `authorization: Bearer {access_token}`, `chatgpt-account-id: {account_id}`, `openai-beta: responses=experimental`, `originator: codex_cli_rs`, `session_id: uuid`, `accept: text/event-stream`
- 바디: `{ model, instructions, input:[{role,content:[{type:input_text|output_text,text}]}], stream:true, store:false }`
- 응답: SSE. `response.output_text.delta` 누적, fallback `response.completed`.
- 모델: `gpt-5.5`(번역, env TRANSLATE_MODEL), `gpt-5.4-mini`(키워드, env KEYWORD_MODEL). 검증 시 `gpt-5.4-mini`→`gpt-5.4-mini-2026-03-17` 해석됨.

## 기능

- `translateToKo(title, content)` → `{ titleTranslated, bodyTranslated }`. 본문은 `htmlToText` 후 12k 자 컷. 코드/식별자 verbatim 프롬프트.
- `extractKeywords(title, content)` → `string[]` (3~8개, JSON 배열 파싱, 191자 컷 = keyword 컬럼 길이).

## 알려진 제약 / TODO

- **토큰 만료/refresh**: 현재 access_token 직접 사용. 장기 cron 에서 만료 시 `refresh_token`으로 갱신 로직 필요(`https://auth.openai.com/oauth/token`). 미구현 → 만료 시 401, step 7 에서 refresh 추가 예정.
- **리포트 생성 함수**(일일/주간 markdown) 미구현 — step 5 잔여.
- rate/비용: 회당 호출 = 기사수 × 2(번역+키워드). step 7 에서 신규 기사만 처리(skipUrl)로 제한.
