const VENDOR_LIST = ['openai', 'anthropic', 'google', 'meta', 'naver', 'kakao'] as const
const LANG_LIST = ['ko', 'ja', 'en'] as const

type ReportKind = 'daily' | 'weekly'

const genReport = async (kind: ReportKind, vendor: string | null, lang: string) => {
    'use step'
    const { generateReport } = await import('@lib/ai/report')
    const result = await generateReport(kind, vendor as never, lang as never)
    return result ?? 0
}

export const reportWorkflow = async (kind: ReportKind) => {
    'use workflow'

    let created = 0

    for (const lang of LANG_LIST) {
        try {
            if (await genReport(kind, null, lang)) created += 1
        } catch {
            continue
        }
    }

    for (const vendor of VENDOR_LIST) {
        try {
            if (await genReport(kind, vendor, 'ko')) created += 1
        } catch {
            continue
        }
    }

    return { created }
}
