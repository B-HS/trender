const VENDOR_LIST = ['openai', 'anthropic', 'google', 'naver', 'kakao'] as const
const LANG_LIST = ['ko', 'ja', 'en'] as const

type ReportKind = 'daily' | 'weekly'

const genReport = async (kind: ReportKind, vendor: string | null, lang: string) => {
    'use step'
    const { generateReport } = await import('@lib/ai/report')
    const { isCodexLimit } = await import('@lib/ai/codex')
    try {
        const result = await generateReport(kind, vendor as never, lang as never)
        return result ? 1 : 0
    } catch (error) {
        if (isCodexLimit(error)) return 'limited'
        return 0
    }
}

export const reportWorkflow = async (kind: ReportKind) => {
    'use workflow'

    const tasks: { vendor: string | null; lang: string }[] = [
        ...LANG_LIST.map((lang) => ({ vendor: null, lang })),
        ...VENDOR_LIST.map((vendor) => ({ vendor, lang: 'ko' })),
    ]

    let created = 0
    let limited = false
    for (const task of tasks) {
        const result = await genReport(kind, task.vendor, task.lang)
        if (result === 'limited') {
            limited = true
            break
        }
        created += result
    }

    return { created, limited }
}
