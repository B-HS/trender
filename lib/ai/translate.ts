import { getEnv } from '@lib/env'
import { htmlToText } from '@lib/crawl/html'
import { callCodex } from './codex'

const INSTRUCTION =
    '너는 AI/기술 기사 번역가다. 입력된 제목과 본문을 자연스러운 한국어로 번역한다. ' +
    '제품명·도구명·식별자·코드·명령어는 원문 그대로 두고 산문만 번역한다. ' +
    '반드시 아래 형식으로만 응답한다:\nTITLE: <번역된 제목>\nBODY:\n<번역된 본문>'

export const translateToKo = async (title: string, content: string | null) => {
    const body = content ? htmlToText(content).slice(0, 12000) : ''
    const out = await callCodex({
        model: getEnv().TRANSLATE_MODEL,
        instructions: INSTRUCTION,
        input: [{ role: 'user', text: `TITLE: ${title}\nBODY:\n${body}` }],
    })
    const titleMatch = /TITLE:\s*(.*)/.exec(out)
    const bodyIdx = out.indexOf('BODY:')
    const titleTranslated = titleMatch?.[1]?.trim() || title
    const bodyTranslated = bodyIdx >= 0 ? out.slice(bodyIdx + 5).trim() : out.trim()
    return { titleTranslated, bodyTranslated }
}
