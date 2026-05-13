from __future__ import annotations

from trender.llm.base import LLMError
from trender.llm.openai_compat import OpenAICompatClient


class OpenRouterClient(OpenAICompatClient):
    name = "openrouter"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        host: str = "https://openrouter.ai/api/v1",
        referer: str | None = None,
        app_title: str | None = None,
        timeout: float = 90.0,
    ) -> None:
        if not api_key:
            raise LLMError("OPENROUTER_API_KEY is empty")
        extra: dict[str, str] = {}
        if referer:
            extra["HTTP-Referer"] = referer
        if app_title:
            extra["X-Title"] = app_title
        super().__init__(
            base_url=host,
            model=model,
            api_key=api_key,
            extra_headers=extra,
            timeout=timeout,
            name="openrouter",
        )
