from __future__ import annotations

from typing import Any, Awaitable, Callable

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from trender.llm.base import LLMClient, LLMError

TokenProvider = Callable[[], Awaitable[str | None]] | None


class OpenAICompatClient(LLMClient):
    """OpenAI 의 /v1/chat/completions 와 호환되는 모든 백엔드용 공통 어댑터."""

    name = "openai-compat"

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str | None = None,
        token_provider: TokenProvider = None,
        extra_headers: dict[str, str] | None = None,
        timeout: float = 90.0,
        name: str | None = None,
    ) -> None:
        if not api_key and token_provider is None:
            api_key = ""  # 로컬 서버 등 인증 없는 경우 허용
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._api_key = api_key
        self._token_provider = token_provider
        self._extra_headers = extra_headers or {}
        self._client = httpx.AsyncClient(base_url=self._base_url, timeout=timeout)
        if name:
            self.name = name

    async def _build_headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Content-Type": "application/json", **self._extra_headers}
        token: str | None
        if self._token_provider is not None:
            token = await self._token_provider()
        else:
            token = self._api_key
        if token:
            headers.setdefault("Authorization", f"Bearer {token}")
        return headers

    @retry(
        reraise=True,
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=6),
        retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    )
    async def complete(self, *, system: str, user: str, temperature: float = 0.2) -> str:
        headers = await self._build_headers()
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "stream": False,
        }
        resp = await self._client.post("/chat/completions", headers=headers, json=payload)
        if resp.status_code >= 400:
            raise LLMError(f"{self.name} HTTP {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            raise LLMError(f"{self.name} empty choices: {data}")
        content = (choices[0].get("message") or {}).get("content")
        if not content:
            raise LLMError(f"{self.name} empty content: {data}")
        return content.strip()

    async def aclose(self) -> None:
        await self._client.aclose()
