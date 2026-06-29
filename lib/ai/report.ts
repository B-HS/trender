import { getArticlesForPeriod, insertReport, reportExists, type ReportKind } from '@entities/report/report.repo'
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
    `You are an analyst writing an in-depth AI/tech trend report. Your entire response MUST be written in natural, fluent ${language}; ` +
    `translate non-${language} concepts but keep proper nouns (product, company, code identifiers) in their original form.\n` +
    "You are given a numbered list of articles; each item has a TITLE line followed by an excerpt of the article's CONTENT. Read the content, not just the titles. Identify 4-6 key trends and write a thorough section for each.\n" +
    '\n' +
    'Requirements:\n' +
    '- Write a long, substantial report, NOT a brief summary. Each trend section MUST be at least 3 full paragraphs explaining what is happening, the concrete details from the article bodies, why it matters, and how the articles connect to each other.\n' +
    '- Ground every claim in the provided CONTENT excerpts: quote specific products, companies, model names, techniques, version numbers, benchmarks, prices, and figures that appear in the bodies. Do not write generic filler.\n' +
    '- Cover all the major articles across the topics; do not omit important items. Aim to reference most of the numbered items.\n' +
    `- Write with the SAME depth and length no matter the output language. Do NOT be more terse in ${language} than you would be in English; a ${language} report must be just as detailed and long.\n` +
    "- Target roughly 1000-1400 words total. End with a short '## 종합 / Summary' style outlook paragraph (in the report language).\n" +
    '\n' +
    'Output format: GitHub Flavored Markdown only.\n' +
    '- Use ##, ### for headings (not bold), - for bullets, **bold**, inline `code`, > blockquotes, | tables where useful.\n' +
    '- Do NOT add a top-level # title, HTML tags, or wrap the whole response in a code block.\n' +
    '- When you mention an article, cite it using its number as [#1], [#3] (bracket-hash-number). Do NOT use markdown links for citations; only the [#n] form.'

const REPORT_BODY_CHARS = 16000

const summarize = (body: string | null) =>
    (body ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, REPORT_BODY_CHARS)

const toMysql = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')
const toDate = (d: Date) => d.toISOString().slice(0, 10)

export const generateReport = async (kind: ReportKind, vendor: Vendor | null, lang: Lang = 'ko', now = new Date(), skipIfExists = true) => {
    const spanMs = kind === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
    const since = new Date(now.getTime() - spanMs)
    const vendorKey = vendor ?? 'none'

    if (skipIfExists && (await reportExists({ kind, lang, vendor, periodStart: toDate(since), periodEnd: toDate(now) }))) return null

    const articles = await getArticlesForPeriod({ vendor: vendorKey, since: toMysql(since), limit: 30, lang: vendor === null ? lang : undefined })
    if (articles.length === 0) return null

    const list = articles.map((a, i) => `${i + 1}. ${a.title}\n${summarize(a.body)}`).join('\n\n')
    const config = LANG_CONFIG[lang]
    const markdown = await callCodex({
        model: getEnv().TRANSLATE_MODEL,
        instructions: instruction(config.language),
        input: [{ role: 'user', text: list }],
        effort: 'medium',
    })
    if (!markdown) return null

    const scope = vendor ? VENDOR_LABEL[vendor] : config.scope
    const title = `${scope} ${kind === 'daily' ? config.daily : config.weekly} (${toDate(now)})`

    return insertReport(
        { kind, lang, vendor, periodStart: toDate(since), periodEnd: toDate(now), title, markdown },
        articles.map((a) => a.id),
    )
}
