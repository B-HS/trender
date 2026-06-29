import { spawn } from 'child_process'
import mysql from 'mysql2/promise'

const ENGINE = process.env.ENGINE ?? 'ollama'
const KEY = process.env.OLLAMA_KEY
if (ENGINE === 'ollama' && !KEY) throw new Error('OLLAMA_KEY required')
const MODEL = process.env.MODEL ?? 'deepseek-v4-pro:cloud'
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'sonnet'
const CONCURRENCY = Number(process.env.CONC ?? 3)
const DRY = process.env.DRY === '1'
const FORCE = process.env.FORCE === '1'
const { callCodex } = ENGINE === 'codex' ? await import('/Users/gkn/ts-trender/lib/ai/codex') : { callCodex: null }
const BASE = process.env.BASE ?? '2026-06-24'
const BODY_CHARS = Number(process.env.BODY_CHARS ?? 16000)
const NUM_CTX = Number(process.env.NUM_CTX ?? 131072)
const EXISTING = process.env.EXISTING === '1'
const summarize = (s: string | null) =>
    (s ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, BODY_CHARS)
const DAILY_DAYS = Number(process.env.DAILY_DAYS ?? 10)
const WEEKLY_WEEKS = Number(process.env.WEEKLY_WEEKS ?? 6)

const COMBOS = [
    { vendor: null, lang: 'ko' },
    { vendor: null, lang: 'ja' },
    { vendor: null, lang: 'en' },
    { vendor: 'openai', lang: 'ko' },
    { vendor: 'anthropic', lang: 'ko' },
    { vendor: 'google', lang: 'ko' },
    { vendor: 'naver', lang: 'ko' },
    { vendor: 'kakao', lang: 'ko' },
] as const

const LANG_CONFIG: Record<string, { language: string; daily: string; weekly: string; scope: string }> = {
    ko: { language: '한국어', daily: '일일', weekly: '주간', scope: 'AI 트렌드' },
    ja: {
        language: '日本語',
        daily: 'デイリー',
        weekly: 'ウィークリー',
        scope: 'AIトレンド',
    },
    en: {
        language: 'English',
        daily: 'Daily',
        weekly: 'Weekly',
        scope: 'AI Trends',
    },
}

const VENDOR_LABEL: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    naver: 'Naver',
    kakao: 'Kakao',
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

const addDays = (ymd: string, n: number) => {
    const [y, m, d] = ymd.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + n)
    return dt.toISOString().slice(0, 10)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const backoff = (a: number) => Math.min(20000, 700 * (a + 1) * (a + 1)) + Math.floor(Math.random() * 400)

const callOllama = async (system: string, user: string) => {
    for (let a = 0; ; a++) {
        let res: Response
        try {
            res = await fetch('https://ollama.com/api/chat', {
                method: 'POST',
                signal: AbortSignal.timeout(300000),
                headers: {
                    authorization: `Bearer ${KEY}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: MODEL,
                    think: false,
                    stream: false,
                    options: { num_ctx: NUM_CTX },
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: user },
                    ],
                }),
            })
        } catch (e) {
            if (a >= 5) throw e
            await sleep(backoff(a))
            continue
        }
        if (res.status === 429 || res.status >= 500) {
            if (a >= 6) throw new Error(`ollama ${res.status}`)
            await sleep(backoff(a))
            continue
        }
        if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 200)}`)
        const data = (await res.json()) as { message?: { content?: string } }
        const content = String(data?.message?.content ?? '').trim()
        if (!content) {
            if (a >= 6) throw new Error('empty content')
            await sleep(backoff(a))
            continue
        }
        return content
    }
}

const claudeOnce = (system: string, user: string) =>
    new Promise<string>((resolve, reject) => {
        const p = spawn('claude', ['-p', '--model', CLAUDE_MODEL, '--output-format', 'text'])
        let out = ''
        let err = ''
        p.stdout.on('data', (d: Buffer) => (out += d.toString()))
        p.stderr.on('data', (d: Buffer) => (err += d.toString()))
        p.on('error', reject)
        p.on('close', (code) => (code === 0 && out.trim() ? resolve(out.trim()) : reject(new Error(`claude ${code}: ${err.slice(0, 200)}`))))
        p.stdin.write(`${system}\n\n# Articles\n${user}`)
        p.stdin.end()
    })

const callClaude = async (system: string, user: string) => {
    for (let a = 0; ; a++) {
        try {
            return await claudeOnce(system, user)
        } catch (e) {
            if (a >= 3) throw e
            await sleep(backoff(a))
        }
    }
}

const conn = mysql.createPool({
    uri: process.env.DATABASE_URL as string,
    connectionLimit: CONCURRENCY + 2,
    waitForConnections: true,
})

type Job = {
    kind: 'daily' | 'weekly'
    vendor: string | null
    lang: string
    periodStart: string
    periodEnd: string
}

const jobs: Job[] = []
if (EXISTING) {
    const minEnd = process.env.MIN_END
    const maxEnd = process.env.MAX_END
    const onlyKind = process.env.KIND
    const where = [onlyKind ? 'kind = ?' : '', minEnd ? 'period_end >= ?' : '', maxEnd ? 'period_end <= ?' : ''].filter(Boolean).join(' and ')
    const [rows] = (await conn.query(
        `select kind, lang, vendor,
                date_format(period_start, '%Y-%m-%d') periodStart,
                date_format(period_end, '%Y-%m-%d') periodEnd
         from reports ${where ? `where ${where}` : ''} group by kind, lang, vendor, period_start, period_end`,
        [onlyKind, minEnd, maxEnd].filter(Boolean),
    )) as unknown as [Job[]]
    jobs.push(...rows)
} else {
    for (let i = 0; i < DAILY_DAYS; i++) {
        const end = addDays(BASE, -i)
        for (const cb of COMBOS)
            jobs.push({
                kind: 'daily',
                vendor: cb.vendor,
                lang: cb.lang,
                periodStart: addDays(end, -1),
                periodEnd: end,
            })
    }
    for (let i = 0; i < WEEKLY_WEEKS; i++) {
        const end = addDays(BASE, -7 * i)
        for (const cb of COMBOS)
            jobs.push({
                kind: 'weekly',
                vendor: cb.vendor,
                lang: cb.lang,
                periodStart: addDays(end, -7),
                periodEnd: end,
            })
    }
}

const reportExists = async (j: Job) => {
    const [rows] = (await conn.query(
        'select id from reports where kind=? and lang=? and period_start=? and period_end=? and (vendor <=> ?) and exists (select 1 from report_items ri where ri.report_id = reports.id) limit 1',
        [j.kind, j.lang, j.periodStart, j.periodEnd, j.vendor],
    )) as unknown as [{ id: number }[]]
    return rows.length > 0
}

const getArticles = async (j: Job) => {
    const vendorClause = j.vendor === null ? 's.vendor is null' : 's.vendor = ?'
    const params: (string | number)[] = []
    if (j.vendor !== null) params.push(j.vendor)
    params.push(`${j.periodStart} 00:00:00`, `${j.periodEnd} 00:00:00`)
    const [rows] = (await conn.query(
        `select a.id, coalesce(a.title_translated_ko, a.title_original) title,
                coalesce(a.content_translated_ko, a.content_original) body
         from articles a join sources s on s.id=a.source_id
         where ${vendorClause} and a.fetched_at >= ? and a.fetched_at < ?
         order by a.id desc limit 30`,
        params,
    )) as unknown as [{ id: number; title: string; body: string | null }[]]
    return rows
}

const insertReport = async (j: Job, title: string, markdown: string, ids: number[]) => {
    await conn.query('delete from reports where kind=? and lang=? and period_start=? and period_end=? and (vendor <=> ?)', [
        j.kind,
        j.lang,
        j.periodStart,
        j.periodEnd,
        j.vendor,
    ])
    const [res] = (await conn.query('insert into reports (kind, lang, vendor, period_start, period_end, title, markdown) values (?,?,?,?,?,?,?)', [
        j.kind,
        j.lang,
        j.vendor,
        j.periodStart,
        j.periodEnd,
        title.slice(0, 512),
        markdown,
    ])) as unknown as [{ insertId: number }]
    const reportId = Number(res.insertId)
    if (reportId > 0 && ids.length > 0) {
        await conn.query(
            'insert into report_items (report_id, article_id, `rank`) values ' + ids.map(() => '(?,?,?)').join(','),
            ids.flatMap((id, idx) => [reportId, id, idx + 1]),
        )
    }
    return reportId
}

const process_ = async (j: Job) => {
    if (!FORCE && (await reportExists(j))) return 'exists'
    const articles = await getArticles(j)
    if (articles.length === 0) return 'empty'
    const cfg = LANG_CONFIG[j.lang]
    const scope = j.vendor ? VENDOR_LABEL[j.vendor] : cfg.scope
    const title = `${scope} ${j.kind === 'daily' ? cfg.daily : cfg.weekly} (${j.periodEnd})`
    if (DRY) return `would-create(${articles.length}a)`
    const list = articles.map((a, i) => `${i + 1}. ${a.title}\n${summarize(a.body)}`).join('\n\n')
    const markdown =
        ENGINE === 'claude'
            ? await callClaude(instruction(cfg.language), list)
            : callCodex
              ? await callCodex({
                    model: process.env.TRANSLATE_MODEL || 'gpt-5.4-mini',
                    instructions: instruction(cfg.language),
                    input: [{ role: 'user', text: list }],
                    effort: 'medium',
                })
              : await callOllama(instruction(cfg.language), list)
    await insertReport(
        j,
        title,
        markdown,
        articles.map((a) => a.id),
    )
    return 'created'
}

let created = 0
let existed = 0
let empty = 0
let failed = 0
let idx = 0
const startedAt = Date.now()

const worker = async () => {
    while (true) {
        const i = idx++
        if (i >= jobs.length) break
        const j = jobs[i]
        const tag = `${j.kind}/${j.lang}/${j.vendor ?? 'general'} ${j.periodStart}~${j.periodEnd}`
        try {
            const r = await process_(j)
            if (r === 'exists') existed++
            else if (r === 'empty') empty++
            else {
                created++
                console.log(`OK ${tag} → ${r}`)
            }
            if (DRY && r !== 'exists' && r !== 'empty') console.log(`DRY ${tag} → ${r}`)
        } catch (e) {
            failed++
            console.error(`FAIL ${tag}: ${String(e).slice(0, 150)}`)
        }
    }
}

await Promise.all(Array.from({ length: DRY ? 1 : CONCURRENCY }, () => worker()))
console.log(
    `\nDONE jobs=${jobs.length} created=${created} existed=${existed} empty=${empty} failed=${failed} elapsed=${Math.round((Date.now() - startedAt) / 1000)}s`,
)
await conn.end()
