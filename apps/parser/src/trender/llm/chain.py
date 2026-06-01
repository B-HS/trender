from __future__ import annotations

from pathlib import Path
from typing import Callable, Sequence

from trender.config import Settings, get_settings
from trender.llm.base import AllProvidersFailedError, LLMClient
from trender.llm.ollama_cloud import OllamaCloudClient
from trender.llm.ollama_local import OllamaLocalClient
from trender.llm.omlx_local import OmlxLocalClient
from trender.llm.openai_oauth import OpenAIOAuthClient
from trender.llm.openrouter import OpenRouterClient
from trender.logging import get_logger

log = get_logger(__name__)


class FallbackChain(LLMClient):
    name = "fallback"

    def __init__(self, clients: Sequence[LLMClient]) -> None:
        if not clients:
            raise ValueError("FallbackChain requires at least one client")
        self._clients = list(clients)

    async def complete(self, *, system: str, user: str, temperature: float = 0.2) -> str:
        errors: list[tuple[str, str]] = []
        for client in self._clients:
            try:
                result = await client.complete(system=system, user=user, temperature=temperature)
                log.info("llm.success", provider=client.name)
                return result
            except Exception as e:
                log.warning("llm.failed", provider=client.name, error=str(e))
                errors.append((client.name, str(e)))
        raise AllProvidersFailedError(f"All LLM providers failed: {errors}")

    async def aclose(self) -> None:
        for client in self._clients:
            close = getattr(client, "aclose", None)
            if close is not None:
                try:
                    await close()
                except Exception as e:
                    log.warning("llm.close_failed", provider=client.name, error=str(e))


ProviderBuilder = Callable[[Settings], LLMClient | None]


def _build_ollama_cloud(s: Settings) -> LLMClient | None:
    if not s.ollama_cloud_key:
        return None
    return OllamaCloudClient(api_key=s.ollama_cloud_key, host=s.ollama_cloud_host, model=s.ollama_cloud_model)


def _build_ollama_local(s: Settings) -> LLMClient | None:
    if not s.ollama_host:
        return None
    return OllamaLocalClient(
        host=s.ollama_host,
        model=s.ollama_local_model,
        num_ctx=s.ollama_num_ctx,
        timeout=s.ollama_timeout_seconds,
    )


def _build_omlx_local(s: Settings) -> LLMClient | None:
    return OmlxLocalClient(host=s.omlx_host, model=s.omlx_model)


def _build_openrouter(s: Settings) -> LLMClient | None:
    if not s.openrouter_api_key:
        return None
    return OpenRouterClient(
        api_key=s.openrouter_api_key,
        model=s.openrouter_model,
        host=s.openrouter_host,
        referer=s.openrouter_referer,
        app_title=s.openrouter_app_title,
    )


def _build_openai_oauth(s: Settings) -> LLMClient | None:
    auth_file = Path(s.openai_oauth_auth_file).expanduser() if s.openai_oauth_auth_file else None
    has_explicit = bool(s.openai_oauth_token)
    has_auth_file = (auth_file or (Path.home() / ".codex" / "auth.json")).exists() if auth_file else (
        Path.home() / ".codex" / "auth.json"
    ).exists()
    if not has_explicit and not has_auth_file:
        return None
    return OpenAIOAuthClient(
        model=s.openai_oauth_model,
        base_url=s.openai_oauth_base_url,
        explicit_token=s.openai_oauth_token,
        auth_file=auth_file,
    )


_BUILDERS: dict[str, ProviderBuilder] = {
    "ollama_cloud": _build_ollama_cloud,
    "ollama_local": _build_ollama_local,
    "omlx_local": _build_omlx_local,
    "openrouter": _build_openrouter,
    "openai_oauth": _build_openai_oauth,
}


def build_default_chain() -> FallbackChain:
    settings = get_settings()
    order = [p.strip() for p in settings.llm_providers.split(",") if p.strip()]
    clients: list[LLMClient] = []
    for provider in order:
        builder = _BUILDERS.get(provider)
        if builder is None:
            log.warning("llm.unknown_provider", provider=provider)
            continue
        try:
            client = builder(settings)
        except Exception as e:
            log.warning("llm.build_failed", provider=provider, error=str(e))
            continue
        if client is None:
            log.info("llm.skip_unconfigured", provider=provider)
            continue
        log.info("llm.registered", provider=provider, client=client.name)
        clients.append(client)
    if not clients:
        raise RuntimeError(
            f"No LLM providers configured. LLM_PROVIDERS={settings.llm_providers}. "
            "Set at least one provider's credentials in .env"
        )
    return FallbackChain(clients)
