import { getEnv } from '@lib/env'
import { callCodex } from './codex'

export const TRANSLATE_BODY_CHAR_LIMIT = 16000
export const KEYWORD_BODY_CHAR_LIMIT = 8000

const INSTRUCTION =
    'You process a foreign tech/AI news article and do TWO things, returning them in the EXACT format below.\n' +
    '1) KEYWORDS: extract 3 to 8 keywords that literally appear in the SOURCE-LANGUAGE text — verbatim substrings, original script, no translation, no invention.\n' +
    '2) TRANSLATION: translate the title and body into natural, fluent Korean (한국어). The body is HTML or Markdown — preserve its markup (every tag/attribute/URL or Markdown token) EXACTLY and translate only visible text. Keep proper nouns, code, numbers, dates, and citation tokens like [#1] unchanged.\n' +
    '\n' +
    'Respond in EXACTLY this format and nothing else (no code fences, no commentary):\n' +
    'KEYWORDS: <single-line JSON array of source-language strings>\n' +
    'TITLE: <translated Korean title>\n' +
    'BODY:\n' +
    '<translated Korean body with markup preserved>'

const parseKeywords = (line: string) => {
    const match = /\[[\s\S]*\]/.exec(line)
    if (!match) return [] as string[]
    try {
        const parsed = JSON.parse(match[0]) as unknown[]
        return parsed.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map((k) => k.trim().slice(0, 191))
    } catch {
        return [] as string[]
    }
}

export const extractAndTranslate = async (title: string, content: string | null) => {
    const body = content ? content.slice(0, TRANSLATE_BODY_CHAR_LIMIT) : ''
    const out = await callCodex({
        model: getEnv().TRANSLATE_MODEL,
        instructions: INSTRUCTION,
        input: [{ role: 'user', text: `TITLE: ${title}\nBODY:\n${body}` }],
    })

    const kwMatch = /KEYWORDS:\s*(.*)/.exec(out)
    const titleMatch = /TITLE:\s*(.*)/.exec(out)
    const bodyIdx = out.indexOf('BODY:')
    return {
        keywords: parseKeywords(kwMatch?.[1] ?? ''),
        titleKo: titleMatch?.[1]?.trim() || title,
        bodyKo: bodyIdx >= 0 ? out.slice(bodyIdx + 5).trim() : out.trim(),
    }
}
