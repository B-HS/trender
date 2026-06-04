from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

Lang = Literal["ko", "ja", "en"]


@dataclass
class Message:
    role: str
    content: str


class LLMError(Exception):
    pass


class AllProvidersFailedError(LLMError):
    pass


KEYWORD_EXTRACTION_SYSTEM_PROMPT = (
    "You are a precision keyword-extraction engine for tech and AI news articles.\n"
    "Your sole job: read an article body in its original language (Korean, Japanese, or English) "
    "and return EVERY meaningful keyword that appears in the text, in the SOURCE LANGUAGE, "
    "verbatim and without translation.\n"
    "\n"
    "ABSOLUTE LANGUAGE RULE — violating this fails the task:\n"
    "- If the article is English, EVERY keyword you output MUST be English (Latin script only). Never emit Korean (한글), Japanese kana/kanji, or any non-Latin script.\n"
    "- If the article is Japanese, every keyword MUST be Japanese (kana/kanji/Latin as it appears in the body). Never emit Korean Hangul.\n"
    "- If the article is Korean, every keyword MUST be Korean (Hangul/Latin as it appears). Never emit Japanese kana.\n"
    "- You are NOT translating. You are quoting substrings of the body. If a concept has no English term in the body, do NOT invent a Korean or Japanese label for it.\n"
    "- A keyword must be a literal substring of the article body or title. If you cannot find the exact characters in the source text, do not output it.\n"
    "\n"
    "Other hard rules:\n"
    "- Preserve original casing, spacing, punctuation and scripts exactly as they appear in the source.\n"
    "- Output JSON only. No prose, no markdown fences, no commentary.\n"
)


def build_report_system_prompt(lang: Lang) -> str:
    """언어별 리포트 작성 시스템 프롬프트. 출력 언어를 해당 lang으로 강제."""
    lang_directive = {
        "ko": (
            "Your entire response MUST be written in natural, fluent Korean (한국어).\n"
            "Korean readers expect Korean prose. Translate any non-Korean concepts into Korean, "
            "but keep proper nouns (product, company, code identifiers) in their original form."
        ),
        "ja": (
            "Your entire response MUST be written in natural, fluent Japanese (日本語).\n"
            "Japanese readers expect Japanese prose. Translate any non-Japanese concepts into Japanese, "
            "but keep proper nouns (product, company, code identifiers) in their original form."
        ),
        "en": (
            "Your entire response MUST be written in natural, fluent English.\n"
            "English readers expect English prose. Translate any non-English concepts into English, "
            "but keep proper nouns (product, company, code identifiers) in their original form."
        ),
    }[lang]
    return (
        "You are an analyst writing an in-depth trend report for tech and AI news.\n"
        + lang_directive
        + "\n\n"
        + "Output format: GitHub Flavored Markdown ONLY.\n"
        "- Use `#`, `##`, `###` for headings (not bold).\n"
        "- Use `-` or `*` for bullet lists, `1.` for ordered lists.\n"
        "- Use `**bold**`, `*italic*`, inline `code`, and ```fenced code blocks``` when appropriate.\n"
        "- Use `> ` for blockquotes and `|` for tables.\n"
        "- Do NOT wrap the whole response in a code block.\n"
        "- Do NOT add any HTML tags.\n"
        "- Use proper Markdown link syntax `[text](url)` for any URLs."
    )


ARTICLE_TRANSLATION_SYSTEM_PROMPT = (
    "You are a professional translator who renders foreign tech/AI news articles into natural, fluent Korean (한국어).\n"
    "The input is the article body as HTML. Translate it into Korean while preserving the HTML structure.\n"
    "\n"
    "Hard rules:\n"
    "- Output ONLY the translated HTML. No prose, no commentary, no markdown code fences.\n"
    "- Keep every HTML tag, attribute, and URL exactly as in the input. Translate ONLY human-readable text nodes.\n"
    "- Keep proper nouns (product, company, person, code identifiers) in their original form; you may add a Korean gloss only when natural.\n"
    "- Do not summarize, omit, or add content. Translate faithfully and completely.\n"
    "- Preserve numbers, dates, prices, and quotes exactly.\n"
)


REPORT_TRANSLATION_SYSTEM_PROMPT = (
    "You are a professional translator who renders foreign tech/AI trend reports into natural, fluent Korean (한국어).\n"
    "The input is a GitHub Flavored Markdown report. Translate it into Korean while preserving the Markdown structure.\n"
    "\n"
    "Hard rules:\n"
    "- Output ONLY the translated Markdown. No prose, no commentary, no surrounding code fences.\n"
    "- Preserve all Markdown syntax exactly: headings (#), lists, tables, bold/italic, blockquotes, links, code blocks.\n"
    "- Keep every citation token like `[#1]`, `[#12]` EXACTLY as-is — do not translate, renumber, or remove them.\n"
    "- Keep links `[text](url)` working; translate the visible text but never alter the URL.\n"
    "- Keep proper nouns (product, company, person, code identifiers) in their original form.\n"
    "- Do not summarize, omit, or add content. Translate faithfully and completely. Preserve numbers, dates, prices, quotes.\n"
)


class LLMClient(ABC):
    name: str

    @abstractmethod
    async def complete(self, *, system: str, user: str, temperature: float = 0.2) -> str: ...

    async def complete_json(self, *, system: str, user: str, temperature: float = 0.0) -> str:
        return await self.complete(system=system, user=user, temperature=temperature)
