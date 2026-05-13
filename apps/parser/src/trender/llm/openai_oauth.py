from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import httpx

from trender.llm.base import LLMError
from trender.llm.openai_compat import OpenAICompatClient
from trender.logging import get_logger

log = get_logger(__name__)


_REFRESH_LEEWAY_SECONDS = 60


class _CodexAuthFileStore:
    """Codex CLI 가 ~/.codex/auth.json 에 저장하는 OAuth 토큰을 읽는다."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._cache: dict[str, Any] | None = None
        self._loaded_mtime: float | None = None

    def _load(self) -> dict[str, Any]:
        try:
            mtime = self._path.stat().st_mtime
        except FileNotFoundError as e:
            raise LLMError(
                f"OAuth credential file not found at {self._path}. Run `codex login` first or set OPENAI_OAUTH_TOKEN."
            ) from e
        if self._cache is None or self._loaded_mtime != mtime:
            self._cache = json.loads(self._path.read_text(encoding="utf-8"))
            self._loaded_mtime = mtime
        return self._cache

    def _save(self, data: dict[str, Any]) -> None:
        self._path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        self._cache = data
        try:
            self._loaded_mtime = self._path.stat().st_mtime
        except FileNotFoundError:
            self._loaded_mtime = None

    async def get_access_token(self) -> str:
        data = self._load()
        token = data.get("access_token") or data.get("tokens", {}).get("access_token")
        expires_at = data.get("expires_at") or data.get("tokens", {}).get("expires_at")
        if token and (expires_at is None or float(expires_at) - _REFRESH_LEEWAY_SECONDS > time.time()):
            return token
        refresh_token = data.get("refresh_token") or data.get("tokens", {}).get("refresh_token")
        if not refresh_token:
            raise LLMError("OAuth token expired and no refresh_token available — run `codex login` again.")
        refreshed = await self._refresh(refresh_token, data)
        self._save(refreshed)
        token = refreshed.get("access_token") or refreshed.get("tokens", {}).get("access_token")
        if not token:
            raise LLMError("Refresh returned no access_token")
        return token

    async def _refresh(self, refresh_token: str, prev: dict[str, Any]) -> dict[str, Any]:
        token_url = prev.get("token_url") or "https://auth.openai.com/oauth/token"
        client_id = prev.get("client_id") or os.getenv("OPENAI_OAUTH_CLIENT_ID")
        if not client_id:
            raise LLMError("client_id missing — cannot refresh OAuth token")
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                token_url,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                },
            )
            resp.raise_for_status()
            body = resp.json()
        merged = dict(prev)
        merged.update(body)
        if "expires_in" in body:
            merged["expires_at"] = time.time() + float(body["expires_in"])
        return merged


def _resolve_auth_path() -> Path:
    explicit = os.getenv("OPENAI_OAUTH_AUTH_FILE")
    if explicit:
        return Path(explicit).expanduser()
    return Path.home() / ".codex" / "auth.json"


class OpenAIOAuthClient(OpenAICompatClient):
    """ChatGPT 계정 OAuth (Codex CLI) 로 인증해 OpenAI 호환 엔드포인트를 호출한다."""

    name = "openai-oauth"

    def __init__(
        self,
        *,
        model: str,
        base_url: str = "https://api.openai.com/v1",
        explicit_token: str | None = None,
        auth_file: Path | None = None,
        timeout: float = 90.0,
    ) -> None:
        if explicit_token:
            super().__init__(
                base_url=base_url,
                model=model,
                api_key=explicit_token,
                timeout=timeout,
                name="openai-oauth",
            )
            return
        store = _CodexAuthFileStore(auth_file or _resolve_auth_path())

        async def _provider() -> str:
            return await store.get_access_token()

        super().__init__(
            base_url=base_url,
            model=model,
            token_provider=_provider,
            timeout=timeout,
            name="openai-oauth",
        )
