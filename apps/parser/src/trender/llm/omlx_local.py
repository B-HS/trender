from __future__ import annotations

from trender.llm.openai_compat import OpenAICompatClient


class OmlxLocalClient(OpenAICompatClient):
    """jundot/omlx — Apple Silicon 전용 LLM 추론 서버. OpenAI/Anthropic API drop-in 호환."""

    name = "omlx-local"

    def __init__(self, *, host: str, model: str, timeout: float = 120.0) -> None:
        super().__init__(
            base_url=f"{host.rstrip('/')}/v1",
            model=model,
            api_key="",
            timeout=timeout,
            name="omlx-local",
        )
