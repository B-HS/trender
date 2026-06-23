import { getArticlesForPeriod, insertReport, type ReportKind } from '@entities/report/report.repo'
import type { Lang, Vendor } from '@entities/source/provider.type'
import { getEnv } from '@lib/env'
import { callCodex } from './codex'

const VENDOR_LABEL: Record<Vendor, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    meta: 'Meta',
    naver: 'Naver',
    kakao: 'Kakao',
}

const LANG_CONFIG: Record<Lang, { language: string; daily: string; weekly: string; scope: string }> = {
    ko: { language: '한국어', daily: '일일', weekly: '주간', scope: 'AI 트렌드' },
    ja: { language: '日本語', daily: 'デイリー', weekly: 'ウィークリー', scope: 'AIトレンド' },
    en: { language: 'English', daily: 'Daily', weekly: 'Weekly', scope: 'AI Trends' },
}

const instruction = (language: string) =>
    `You write AI/tech trend reports. From the given article list (title + link), write a Markdown report in ${language}. ` +
    `Group the key trends into 2-4 topics, summarize each, and link related articles as [title](link). ` +
    `Output only the report body in Markdown (no top-level # heading).`

const toMysql = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')
const toDate = (d: Date) => d.toISOString().slice(0, 10)

export const generateReport = async (kind: ReportKind, vendor: Vendor | null, lang: Lang = 'ko', now = new Date()) => {
    const spanMs = kind === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
    const since = new Date(now.getTime() - spanMs)
    const vendorKey = vendor ?? 'none'

    const articles = await getArticlesForPeriod({ vendor: vendorKey, since: toMysql(since), limit: 30 })
    if (articles.length === 0) return null

    const list = articles.map((a) => `- [${a.title}](${a.url})`).join('\n')
    const config = LANG_CONFIG[lang]
    const markdown = await callCodex({
        model: getEnv().TRANSLATE_MODEL,
        instructions: instruction(config.language),
        input: [{ role: 'user', text: list }],
    })
    if (!markdown) return null

    const scope = vendor ? VENDOR_LABEL[vendor] : config.scope
    const title = `${scope} ${kind === 'daily' ? config.daily : config.weekly} (${toDate(now)})`

    return insertReport(
        { kind, lang, vendor, periodStart: toDate(since), periodEnd: toDate(now), title, markdown },
        articles.map((a) => a.id),
    )
}
