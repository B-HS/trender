from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(alias="DATABASE_URL")

    # 우선순위 (콤마 구분). 비어있는 어댑터는 자동 스킵.
    llm_providers: str = Field(
        default="ollama_cloud,omlx_local,openrouter,openai_oauth,ollama_local",
        alias="LLM_PROVIDERS",
    )

    # Ollama Cloud
    ollama_cloud_key: str | None = Field(default=None, alias="OLLAMA_CLOUD_KEY")
    ollama_cloud_host: str = Field(default="https://ollama.com", alias="OLLAMA_CLOUD_HOST")
    ollama_cloud_model: str = Field(default="gpt-oss:120b", alias="OLLAMA_CLOUD_MODEL")
    ollama_cloud_model_light: str | None = Field(default=None, alias="OLLAMA_CLOUD_MODEL_LIGHT")
    ollama_cloud_timeout_seconds: int = Field(default=180, alias="OLLAMA_CLOUD_TIMEOUT_SECONDS")

    # Ollama Local
    ollama_host: str = Field(default="http://localhost:11434", alias="OLLAMA_HOST")
    ollama_local_model: str = Field(default="llama3.1:8b", alias="OLLAMA_LOCAL_MODEL")
    ollama_local_model_light: str | None = Field(default=None, alias="OLLAMA_LOCAL_MODEL_LIGHT")
    ollama_num_ctx: int = Field(default=65536, alias="OLLAMA_NUM_CTX")
    ollama_timeout_seconds: int = Field(default=600, alias="OLLAMA_TIMEOUT_SECONDS")

    # OMLX Local (jundot/omlx — Apple Silicon menu-bar LLM server, OpenAI 호환)
    omlx_host: str = Field(default="http://localhost:8080", alias="OMLX_HOST")
    omlx_model: str = Field(default="mlx-community/Qwen2.5-32B-Instruct-4bit", alias="OMLX_MODEL")
    omlx_model_light: str | None = Field(default=None, alias="OMLX_MODEL_LIGHT")

    # OpenRouter
    openrouter_api_key: str | None = Field(default=None, alias="OPENROUTER_API_KEY")
    openrouter_model: str = Field(default="anthropic/claude-3.5-sonnet", alias="OPENROUTER_MODEL")
    openrouter_model_light: str | None = Field(default=None, alias="OPENROUTER_MODEL_LIGHT")
    openrouter_host: str = Field(default="https://openrouter.ai/api/v1", alias="OPENROUTER_HOST")
    openrouter_referer: str | None = Field(default=None, alias="OPENROUTER_REFERER")
    openrouter_app_title: str | None = Field(default="trender", alias="OPENROUTER_APP_TITLE")

    # OpenAI OAuth (Codex CLI 로그인 토큰 사용)
    openai_oauth_model: str = Field(default="gpt-4o-mini", alias="OPENAI_OAUTH_MODEL")
    openai_oauth_model_light: str | None = Field(default=None, alias="OPENAI_OAUTH_MODEL_LIGHT")
    openai_oauth_base_url: str = Field(default="https://api.openai.com/v1", alias="OPENAI_OAUTH_BASE_URL")
    openai_oauth_token: str | None = Field(default=None, alias="OPENAI_OAUTH_TOKEN")
    openai_oauth_auth_file: str | None = Field(default=None, alias="OPENAI_OAUTH_AUTH_FILE")

    fetch_concurrency: int = Field(default=4, alias="FETCH_CONCURRENCY")
    fetch_timeout_seconds: int = Field(default=30, alias="FETCH_TIMEOUT_SECONDS")
    fetch_per_source_limit: int = Field(default=20, alias="FETCH_PER_SOURCE_LIMIT")

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()  # type: ignore[call-arg]
    return _settings
