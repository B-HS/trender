from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class Message:
    role: str
    content: str


class LLMError(Exception):
    pass


class AllProvidersFailedError(LLMError):
    pass


KOREAN_OUTPUT_SYSTEM_PROMPT = (
    "You are an assistant that summarises tech articles for Korean readers.\n"
    "Your entire response MUST be written in natural, fluent Korean (한국어).\n"
    "Even when the source material is in Japanese or English, translate concepts and produce Korean output.\n"
    "Keep proper nouns (product names, company names, code identifiers) in their original form, "
    "but add a brief Korean clarification when helpful."
)


KOREAN_MARKDOWN_SYSTEM_PROMPT = (
    KOREAN_OUTPUT_SYSTEM_PROMPT
    + "\n\n"
    + "Output format: GitHub Flavored Markdown ONLY.\n"
    "- Use `#`, `##`, `###` for headings (not bold).\n"
    "- Use `-` or `*` for bullet lists, `1.` for ordered lists.\n"
    "- Use `**bold**`, `*italic*`, inline `code`, and ```fenced code blocks``` when appropriate.\n"
    "- Use `> ` for blockquotes and `|` for tables.\n"
    "- Do NOT wrap the whole response in a code block.\n"
    "- Do NOT add any HTML tags.\n"
    "- Do NOT add a closing summary like 'In conclusion'.\n"
    "- Use proper Markdown link syntax `[text](url)` for any URLs."
)


class LLMClient(ABC):
    name: str

    @abstractmethod
    async def complete(self, *, system: str, user: str, temperature: float = 0.2) -> str: ...

    async def complete_json(self, *, system: str, user: str, temperature: float = 0.0) -> str:
        return await self.complete(system=system, user=user, temperature=temperature)
