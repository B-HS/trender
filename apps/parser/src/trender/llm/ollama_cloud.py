from __future__ import annotations

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from trender.llm.base import LLMClient, LLMError


class OllamaCloudClient(LLMClient):
    name = "ollama-cloud"

    def __init__(self, *, api_key: str, host: str, model: str, timeout: float = 600.0) -> None:
        if not api_key:
            raise LLMError("OLLAMA_CLOUD_KEY is empty")
        self._host = host.rstrip("/")
        self._model = model
        self._client = httpx.AsyncClient(
            base_url=self._host,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
        )

    @retry(
        reraise=True,
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    )
    async def complete(self, *, system: str, user: str, temperature: float = 0.2) -> str:
        resp = await self._client.post(
            "/api/chat",
            json={
                "model": self._model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "stream": False,
                "options": {"temperature": temperature},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        content = (data.get("message") or {}).get("content")
        if not content:
            raise LLMError(f"empty response from Ollama Cloud: {data}")
        return content.strip()

    async def aclose(self) -> None:
        await self._client.aclose()
