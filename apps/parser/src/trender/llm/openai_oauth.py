from __future__ import annotations

import base64
import binascii
import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from trender.llm.base import LLMClient, LLMError
from trender.logging import get_logger

log = get_logger(__name__)


_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
_TOKEN_URL = "https://auth.openai.com/oauth/token"
_AUTH_CLAIM = "https://api.openai.com/auth"
_REFRESH_LEEWAY_SECONDS = 300
_DEFAULT_BASE_URL = "https://chatgpt.com/backend-api/codex"


def _decode_jwt_claims(token: str) -> dict[str, Any]:
    """JWT 의 payload(2번째 세그먼트)를 검증 없이 디코드해 claim dict 를 돌려준다."""
    try:
        segment = token.split(".")[1]
        segment += "=" * (-len(segment) % 4)
        return json.loads(base64.urlsafe_b64decode(segment))
    except (IndexError, ValueError, binascii.Error):
        return {}


class _Unauthorized(Exception):
    """ChatGPT 백엔드가 401 을 돌려줄 때 내부적으로 refresh→재시도를 트리거하는 신호."""


def _resolve_auth_path() -> Path:
    explicit = os.getenv("OPENAI_OAUTH_AUTH_FILE")
    if explicit:
        return Path(explicit).expanduser()
    return Path.home() / ".codex" / "auth.json"


class _CodexAuthStore:
    """Codex CLI(~/.codex/auth.json) 의 ChatGPT 로그인 토큰을 읽고, 만료 시 refresh 한다."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._account_id: str | None = None

    def _read(self) -> dict[str, Any]:
        try:
            return json.loads(self._path.read_text(encoding="utf-8"))
        except FileNotFoundError as e:
            raise LLMError(
                f"Codex auth file not found at {self._path}. Run `codex login` first or set OPENAI_OAUTH_TOKEN."
            ) from e

    def account_id(self) -> str | None:
        if self._account_id is not None:
            return self._account_id
        tokens = self._read().get("tokens") or {}
        account_id = tokens.get("account_id")
        if not account_id:
            claims = _decode_jwt_claims(tokens.get("id_token") or "")
            account_id = (claims.get(_AUTH_CLAIM) or {}).get("chatgpt_account_id")
        self._account_id = account_id
        return account_id

    async def access_token(self, *, force_refresh: bool = False) -> str:
        data = self._read()
        tokens = data.get("tokens") or {}
        token = tokens.get("access_token")
        if token and not force_refresh and not _is_expired(token):
            return token
        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            if token and not force_refresh:
                return token
            raise LLMError("Codex auth token expired and no refresh_token available — run `codex login` again.")
        return await self._refresh(data, refresh_token)

    async def _refresh(self, data: dict[str, Any], refresh_token: str) -> str:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                _TOKEN_URL,
                json={"client_id": _CLIENT_ID, "grant_type": "refresh_token", "refresh_token": refresh_token},
            )
        if resp.status_code >= 400:
            raise LLMError(f"Codex token refresh failed: HTTP {resp.status_code} {resp.text[:200]}")
        body = resp.json()
        tokens = data.setdefault("tokens", {})
        for key in ("access_token", "id_token", "refresh_token"):
            if body.get(key):
                tokens[key] = body[key]
        data["last_refresh"] = datetime.now(timezone.utc).isoformat()
        self._write_best_effort(data)
        token = tokens.get("access_token")
        if not token:
            raise LLMError("Codex token refresh returned no access_token")
        log.info("codex_auth.refreshed", path=str(self._path))
        return token

    def _write_best_effort(self, data: dict[str, Any]) -> None:
        try:
            self._path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except OSError as e:
            log.warning("codex_auth.write_failed", path=str(self._path), error=str(e))


def _is_expired(token: str) -> bool:
    exp = _decode_jwt_claims(token).get("exp")
    if not isinstance(exp, (int, float)):
        return False
    return float(exp) - _REFRESH_LEEWAY_SECONDS <= time.time()


class OpenAIOAuthClient(LLMClient):
    """ChatGPT 계정 OAuth(Codex CLI) 로 ChatGPT 백엔드 Responses API 를 호출한다.

    표준 OpenAI API 키가 아니라 구독 쿼터를 쓰므로 `chatgpt.com/backend-api/codex/responses`
    (Responses API, SSE 스트리밍)를 직접 친다. 401 은 토큰 refresh 후 1회 재시도하고,
    429/400/403 은 plain LLMError 로 올려 fallback 체인이 다음 provider 로 넘어가게 한다.
    """

    name = "openai-oauth"

    def __init__(
        self,
        *,
        model: str,
        base_url: str = _DEFAULT_BASE_URL,
        reasoning_effort: str = "low",
        explicit_token: str | None = None,
        auth_file: Path | None = None,
        timeout: float = 180.0,
    ) -> None:
        self._model = model
        self._reasoning_effort = reasoning_effort
        self._explicit_token = explicit_token
        self._store = None if explicit_token else _CodexAuthStore(auth_file or _resolve_auth_path())
        self._session_id = str(uuid.uuid4())
        self._client = httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=timeout)

    async def _token(self, *, force_refresh: bool = False) -> str:
        if self._explicit_token:
            return self._explicit_token
        assert self._store is not None
        return await self._store.access_token(force_refresh=force_refresh)

    def _account_id(self) -> str | None:
        return self._store.account_id() if self._store is not None else None

    def _headers(self, token: str) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "OpenAI-Beta": "responses=experimental",
            "originator": "codex_cli_rs",
            "User-Agent": "codex_cli_rs/0.50.0 (trender parser)",
            "session_id": self._session_id,
        }
        account_id = self._account_id()
        if account_id:
            headers["ChatGPT-Account-ID"] = account_id
        return headers

    def _payload(self, system: str, user: str) -> dict[str, Any]:
        return {
            "model": self._model,
            "instructions": system or " ",
            "input": [
                {"type": "message", "role": "user", "content": [{"type": "input_text", "text": user}]},
            ],
            "tools": [],
            "tool_choice": "auto",
            "parallel_tool_calls": False,
            "reasoning": {"effort": self._reasoning_effort, "summary": "auto"},
            "store": False,
            "stream": True,
            "include": ["reasoning.encrypted_content"],
            "prompt_cache_key": self._session_id,
        }

    @retry(
        reraise=True,
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=6),
        retry=retry_if_exception_type(httpx.TransportError),
    )
    async def complete(self, *, system: str, user: str, temperature: float = 0.2) -> str:
        token = await self._token()
        try:
            return await self._stream_once(token, system, user)
        except _Unauthorized:
            token = await self._token(force_refresh=True)
            try:
                return await self._stream_once(token, system, user)
            except _Unauthorized as e:
                raise LLMError(f"{self.name} unauthorized after token refresh: {e}") from e

    async def _stream_once(self, token: str, system: str, user: str) -> str:
        async with self._client.stream(
            "POST", "/responses", headers=self._headers(token), json=self._payload(system, user)
        ) as resp:
            if resp.status_code >= 400:
                body = (await resp.aread()).decode("utf-8", "replace")
                if resp.status_code == 401:
                    raise _Unauthorized(body[:200])
                raise LLMError(f"{self.name} HTTP {resp.status_code}: {body[:300]}")
            return await self._consume_sse(resp)

    async def _consume_sse(self, resp: httpx.Response) -> str:
        chunks: list[str] = []
        completed = False
        async for line in resp.aiter_lines():
            if not line.startswith("data:"):
                continue
            raw = line[len("data:") :].strip()
            if not raw or raw == "[DONE]":
                continue
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue
            event_type = event.get("type")
            if event_type == "response.output_text.delta":
                delta = event.get("delta")
                if isinstance(delta, str):
                    chunks.append(delta)
            elif event_type == "response.completed":
                completed = True
            elif event_type in ("response.failed", "response.error", "error"):
                raise LLMError(f"{self.name} stream failed: {_event_error(event)}")
            elif event_type == "response.incomplete":
                reason = (event.get("response") or {}).get("incomplete_details")
                raise LLMError(f"{self.name} incomplete: {reason}")
        text = "".join(chunks).strip()
        if text:
            return text
        if not completed:
            raise LLMError(f"{self.name} stream closed before response.completed")
        raise LLMError(f"{self.name} empty text output")

    async def aclose(self) -> None:
        await self._client.aclose()


def _event_error(event: dict[str, Any]) -> str:
    error = event.get("error") or (event.get("response") or {}).get("error") or {}
    if error:
        return f"{error.get('code')}: {error.get('message')}"
    return json.dumps(event)[:300]
