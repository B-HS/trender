import { getEnv } from '@lib/env'
import { htmlToText } from '@lib/crawl/html'
import { callCodex } from './codex'

const INSTRUCTION =
    '너는 AI/기술 기사에서 핵심 키워드를 추출한다. ' +
    '기사 제목과 본문에서 가장 중요한 기술 키워드(제품명·모델명·기법·회사·개념)를 3~8개 뽑는다. ' +
    '반드시 JSON 배열 한 줄로만 응답한다. 예: ["RAG","Claude","fine-tuning"]'

export const extractKeywords = async (title: string, content: string | null) => {
    const body = content ? htmlToText(content).slice(0, 8000) : ''
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
