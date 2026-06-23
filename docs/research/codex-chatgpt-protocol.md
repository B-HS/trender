# Codex(ChatGPT) backend Responses 프로토콜 — TS 포팅 정본

> `~/.codex/auth.json`(ChatGPT 로그인, `auth_mode: chatgpt`)으로 ChatGPT 구독 쿼터를 써서 모델 호출.
> 표준 OpenAI API 키가 아니므로 `api.openai.com/v1/chat/completions`로는 동작 안 함 → ChatGPT 백엔드 Responses(SSE) 전용.
> Python 구현(`apps/parser/.../llm/openai_oauth.py`)은 이번 세션에 라이브 검증됨(gpt-5.4/5.4-mini/5.5 + 키워드 JSON). TS 포팅 시 이 문서를 따른다.

## 1. 인증 파일 (`~/.codex/auth.json` → Vercel은 DB/KV로 이전)
- 읽기: `tokens.access_token`(JWT), `tokens.account_id`(없으면 `tokens.id_token` JWT의 `https://api.openai.com/auth.chatgpt_account_id`), `tokens.refresh_token`. 보존: `auth_mode`, `OPENAI_API_KEY`, `last_refresh`.
- refresh 트리거: access_token JWT `exp <= now+300s` 이면 refresh. + **401 수신 시 1회 refresh 후 재시도**.
- refresh 요청 (**JSON**, form 아님): `POST https://auth.openai.com/oauth/token`, body `{client_id:"app_EMoamEEZ73f0CkXaXp7hrann", grant_type:"refresh_token", refresh_token}`. 응답 `{access_token,id_token,refresh_token?}` → nested `tokens.*` 갱신 + `last_refresh`=now. (refresh_token 회전됨 → 반드시 write-back. **Vercel: 영속 FS 없으니 토큰 저장소를 DB로**, 동시 invocation race는 single-flight/row-lock.)

## 2. 요청
- `POST https://chatgpt.com/backend-api/codex/responses`
- 헤더: `Authorization: Bearer <access_token>` · `ChatGPT-Account-ID: <account_id>` · `Content-Type: application/json` · `Accept: text/event-stream` · `OpenAI-Beta: responses=experimental` · `originator: codex_cli_rs` · `User-Agent: codex_cli_rs/<ver> ...` · `session_id: <uuid>`.
- 바디(최소):
```json
{ "model":"gpt-5.5", "instructions":"<SYSTEM>",
  "input":[{"type":"message","role":"user","content":[{"type":"input_text","text":"<USER>"}]}],
  "tools":[], "tool_choice":"auto", "parallel_tool_calls":false,
  "reasoning":{"effort":"low","summary":"auto"},
  "store":false, "stream":true, "include":["reasoning.encrypted_content"],
  "prompt_cache_key":"<stable-uuid>" }
```
- **system → top-level `instructions`** (input 안에 system 안 넣음). **temperature 미전송**(Responses/reasoning 모델 미지원). `store:false`·`stream:true` 고정.

## 3. 응답 (SSE)
- `data:` 라인별 JSON, `type`으로 분기.
- 텍스트 누적: **`response.output_text.delta` 의 `delta`** concat. 완료: `response.completed`. (`[DONE]` 없음.)
- 에러: `response.failed`/`response.error`/`error` → LLMError. `response.incomplete` → reason.
- **스킵**: `response.reasoning_summary_text.delta`, `response.reasoning_text.delta`(추론 요약 — 누적 금지).

## 4. 모델 / effort
- 모델(`~/.codex/models_cache.json`): `gpt-5.5`(최상), `gpt-5.4`, `gpt-5.4-mini`(경량). report=gpt-5.5, light(키워드/번역)=gpt-5.4-mini.
- reasoning effort: 배치는 `"low"`(default medium은 지연·토큰 큼). 유효값 low/medium/high/xhigh.

## 5. 실패 → fallback 정합
- tenacity/재시도는 **네트워크 에러만**. HTTP 4xx는 `raise_for_status` 금지 → 직접 LLMError(체인이 다음 provider로). 단 **401은 내부에서 refresh→1회 재시도**.
- 429(`usage_limit_reached`)·400·403 = LLMError(재시도 없이 다음 provider). Vercel엔 로컬 Ollama 없음 → Cloud+Codex 2-provider.
