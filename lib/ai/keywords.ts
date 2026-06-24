import { getEnv } from '@lib/env'
import { htmlToText } from '@lib/crawl/html'
import { callCodex } from './codex'
import { KEYWORD_BODY_CHAR_LIMIT } from './enrich'

const INSTRUCTION =
    'You are a precision keyword-extraction engine for tech and AI news articles.\n' +
    'Read the article (title + body) in its original language (Korean, Japanese, or English) and return the most important keywords ' +
    'that literally appear in the text, in the SOURCE LANGUAGE, verbatim and WITHOUT translation.\n' +
    '\n' +
    'Hard rules:\n' +
    '- A keyword MUST be a literal substring of the title or body. Never invent or translate; if the exact characters are not in the text, do not output it.\n' +
    '- If the article is English, every keyword must be English (Latin only). If Japanese, Japanese. If Korean, Korean. Never mix scripts from another language.\n' +
    '- Preserve original casing, spacing, punctuation, and script exactly.\n' +
    '- Return 3 to 8 keywords as a single-line JSON array of strings. Output JSON only — no prose, no code fences.\n' +
    'Example: ["RAG","Claude","fine-tuning"]'

export const extractKeywords = async (title: string, content: string | null) => {
    const body = content ? htmlToText(content).slice(0, KEYWORD_BODY_CHAR_LIMIT) : ''
    const out = await callCodex({
        model: getEnv().KEYWORD_MODEL,
        instructions: INSTRUCTION,
        input: [{ role: 'user', text: `TITLE: ${title}\nBODY:\n${body}` }],
    })
    const match = /\[[\s\S]*\]/.exec(out)
    if (!match) return []
    try {
        const parsed = JSON.parse(match[0]) as unknown[]
        return parsed.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map((k) => k.trim().slice(0, 191))
    } catch {
        return []
    }
}
