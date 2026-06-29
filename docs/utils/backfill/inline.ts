import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import mysql from 'mysql2/promise'

const WORKLIST = '/Users/gkn/.ts-trender-cron/worklist.json'
const LOGS = ['/Users/gkn/.ts-trender-cron/regen.log', '/Users/gkn/.ts-trender-cron/claude-regen.log']
const BODY_CHARS = 16000

const summarize = (s: string | null) =>
    (s ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, BODY_CHARS)

const LANG_CONFIG: Record<string, { language: string; daily: string; weekly: string; scope: string }> = {
    ko: { language: '한국어', daily: '일일', weekly: '주간', scope: 'AI 트렌드' },
    ja: { language: '日本語', daily: 'デイリー', weekly: 'ウィークリー', scope: 'AIトレンド' },
    en: { language: 'English', daily: 'Daily', weekly: 'Weekly', scope: 'AI Trends' },
}
const VENDOR_LABEL: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', naver: 'Naver', kakao: 'Kakao' }

const instruction = (language: string) =>
    `You are an analyst writing an in-depth AI/tech trend report. Your entire response MUST be written in natural, fluent ${language}; ` +
    `translate non-${language} concepts but keep proper nouns (product, company, code identifiers) in their original form.\n` +
    "You are given a numbered list of articles; each item has a TITLE line followed by an excerpt of the article's CONTENT. Read the content, not just the titles. Identify 4-6 key trends and write a thorough section for each.\n\n" +
    'Requirements:\n' +
    '- Write a long, substantial report, NOT a brief summary. Each trend section MUST be at least 3 full paragraphs explaining what is happening, the concrete details from the article bodies, why it matters, and how the articles connect to each other.\n' +
    '- Ground every claim in the provided CONTENT excerpts: quote specific products, companies, model names, techniques, version numbers, benchmarks, prices, and figures that appear in the bodies. Do not write generic filler.\n' +
    '- Cover all the major articles across the topics; do not omit important items. Aim to reference most of the numbered items.\n' +
    `- Write with the SAME depth and length no matter the output language. Do NOT be more terse in ${language} than you would be in English; a ${language} report must be just as detailed and long.\n` +
    "- Target roughly 1000-1400 words total. End with a short '## 종합 / Summary' style outlook paragraph (in the report language).\n\n" +
    'Output format: GitHub Flavored Markdown only.\n' +
    '- Use ##, ### for headings (not bold), - for bullets, **bold**, inline `code`, > blockquotes, | tables where useful.\n' +
    '- Do NOT add a top-level # title, HTML tags, or wrap the whole response in a code block.\n' +
    '- When you mention an article, cite it using its number as [#1], [#3] (bracket-hash-number). Do NOT use markdown links for citations; only the [#n] form.'

const conn = mysql.createPool({ uri: process.env.DATABASE_URL as string, connectionLimit: 2, waitForConnections: true })

type Job = { kind: 'daily' | 'weekly'; lang: string; vendor: string | null; ps: string; pe: string; title: string; done: boolean }

const keyOf = (k: string, l: string, v: string | null, ps: string, pe: string) => `${k}|${l}|${v ?? 'null'}|${ps}|${pe}`

const doneFromLogs = () => {
    const set = new Set<string>()
    for (const f of LOGS) {
        if (!existsSync(f)) continue
        for (const line of readFileSync(f, 'utf8').split('\n')) {
            const m = /^OK (daily|weekly)\/([a-z]+)\/([a-z]+) (\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})/.exec(line)
            if (m) set.add(keyOf(m[1], m[2], m[3] === 'general' ? 'null' : m[3], m[4], m[5]))
        }
    }
    return set
}

const getArticles = async (j: Job) => {
    const langFilter = j.vendor === null
    const vendorClause = j.vendor === null ? 's.vendor is null' : 's.vendor = ?'
    const title = langFilter ? 'a.title_original' : 'coalesce(a.title_translated_ko, a.title_original)'
    const body = langFilter ? 'a.content_original' : 'coalesce(a.content_translated_ko, a.content_original)'
    const params: string[] = []
    if (j.vendor !== null) params.push(j.vendor)
    params.push(`${j.ps} 00:00:00`, `${j.pe} 00:00:00`)
    if (langFilter) params.push(j.lang)
    const [rows] = (await conn.query(
        `select a.id, ${title} title, ${body} body
         from articles a join sources s on s.id=a.source_id
         where ${vendorClause} and a.fetched_at >= ? and a.fetched_at < ?${langFilter ? ' and a.lang = ?' : ''}
         order by a.id desc limit 30`,
        params,
    )) as unknown as [{ id: number; title: string; body: string | null }[]]
    return rows
}

const buildWorklist = async () => {
    const done = doneFromLogs()
    const [rows] = (await conn.query(
        `select kind, lang, vendor,
                date_format(period_start, '%Y-%m-%d') ps,
                date_format(period_end, '%Y-%m-%d') pe
         from reports group by kind, lang, vendor, period_start, period_end
         order by period_end desc, kind asc, vendor asc, lang asc`,
    )) as unknown as [{ kind: 'daily' | 'weekly'; lang: string; vendor: string | null; ps: string; pe: string }[]]
    const jobs: Job[] = rows
        .filter((r) => !done.has(keyOf(r.kind, r.lang, r.vendor, r.ps, r.pe)))
        .map((r) => {
            const cfg = LANG_CONFIG[r.lang]
            const scope = r.vendor ? VENDOR_LABEL[r.vendor] : cfg.scope
            return { ...r, title: `${scope} ${r.kind === 'daily' ? cfg.daily : cfg.weekly} (${r.pe})`, done: false }
        })
    writeFileSync(WORKLIST, JSON.stringify(jobs, null, 2))
    return jobs
}

const loadWorklist = (): Job[] => (existsSync(WORKLIST) ? JSON.parse(readFileSync(WORKLIST, 'utf8')) : [])

const cmd = process.argv[2]

if (cmd === 'build') {
    const jobs = await buildWorklist()
    console.log(`worklist built: ${jobs.length} pending`)
    const byKind = jobs.reduce<Record<string, number>>((a, j) => ((a[j.kind] = (a[j.kind] ?? 0) + 1), a), {})
    console.log(JSON.stringify(byKind))
} else if (cmd === 'buildset') {
    const langs = (process.env.SET_LANGS ?? '').split(',').filter(Boolean)
    const vendorNull = process.env.SET_VENDOR === 'null'
    const [rows] = (await conn.query(
        `select kind, lang, vendor,
                date_format(period_start, '%Y-%m-%d') ps,
                date_format(period_end, '%Y-%m-%d') pe
         from reports
         where ${vendorNull ? 'vendor is null' : '1=1'}${langs.length ? ` and lang in (${langs.map(() => '?').join(',')})` : ''}
         group by kind, lang, vendor, period_start, period_end
         order by period_end desc, kind asc, lang asc`,
        langs,
    )) as unknown as [{ kind: 'daily' | 'weekly'; lang: string; vendor: string | null; ps: string; pe: string }[]]
    const minArticles = Number(process.env.MIN_ARTICLES ?? 3)
    const all: Job[] = rows.map((r) => {
        const cfg = LANG_CONFIG[r.lang]
        const scope = r.vendor ? VENDOR_LABEL[r.vendor] : cfg.scope
        return { ...r, title: `${scope} ${r.kind === 'daily' ? cfg.daily : cfg.weekly} (${r.pe})`, done: false }
    })
    const jobs: Job[] = []
    for (const j of all) {
        const vClause = j.vendor === null ? 's.vendor is null' : 's.vendor = ?'
        const p: string[] = j.vendor === null ? [] : [j.vendor]
        p.push(`${j.ps} 00:00:00`, `${j.pe} 00:00:00`)
        if (j.vendor === null) p.push(j.lang)
        const [cnt] = (await conn.query(
            `select count(*) n from articles a join sources s on s.id=a.source_id where ${vClause} and a.fetched_at >= ? and a.fetched_at < ?${j.vendor === null ? ' and a.lang = ?' : ''}`,
            p,
        )) as unknown as [{ n: number }[]]
        if (cnt[0].n >= minArticles) jobs.push(j)
    }
    writeFileSync(WORKLIST, JSON.stringify(jobs, null, 2))
    console.log(`buildset: ${jobs.length}/${all.length} jobs (>=${minArticles} articles, langs=${langs.join(',') || 'all'} vendorNull=${vendorNull})`)
} else if (cmd === 'status') {
    const jobs = loadWorklist()
    console.log(`pending: ${jobs.filter((j) => !j.done).length} / total ${jobs.length}`)
} else if (cmd === 'next') {
    const jobs = loadWorklist()
    const idx = jobs.findIndex((j) => !j.done)
    if (idx < 0) {
        console.log('ALL_DONE')
    } else {
        const j = jobs[idx]
        const articles = await getArticles(j)
        const list = articles.map((a, i) => `${i + 1}. ${a.title}\n${summarize(a.body)}`).join('\n\n')
        console.log(`===JOB idx=${idx} kind=${j.kind} lang=${j.lang} vendor=${j.vendor ?? 'null'} period=${j.ps}~${j.pe} articles=${articles.length}`)
        console.log(`===TITLE ${j.title}`)
        console.log(`===REMAINING ${jobs.filter((x) => !x.done).length}`)
        console.log('===PROMPT_BEGIN')
        console.log(instruction(LANG_CONFIG[j.lang].language))
        console.log('\n# Articles\n')
        console.log(list)
        console.log('===PROMPT_END')
    }
} else if (cmd === 'prompt') {
    const idx = Number(process.argv[3])
    const jobs = loadWorklist()
    const j = jobs[idx]
    if (!j) throw new Error(`no job at idx ${idx}`)
    const articles = await getArticles(j)
    const list = articles.map((a, i) => `${i + 1}. ${a.title}\n${summarize(a.body)}`).join('\n\n')
    const body = `${instruction(LANG_CONFIG[j.lang].language)}\n\n# Articles\n\n${list}`
    const out = `/Users/gkn/.ts-trender-cron/jobs/job-${idx}.txt`
    writeFileSync(out, body)
    console.log(`idx=${idx} kind=${j.kind} lang=${j.lang} vendor=${j.vendor ?? 'null'} period=${j.ps}~${j.pe} articles=${articles.length}`)
    console.log(`title=${j.title}`)
    console.log(`promptFile=${out}`)
} else if (cmd === 'save') {
    const idx = Number(process.argv[3])
    const mdfile = process.argv[4]
    const jobs = loadWorklist()
    const j = jobs[idx]
    if (!j) throw new Error(`no job at idx ${idx}`)
    const markdown = readFileSync(mdfile, 'utf8').trim()
    if (markdown.length < 400) throw new Error(`markdown too short (${markdown.length})`)
    const articles = await getArticles(j)
    await conn.query('delete from reports where kind=? and lang=? and period_start=? and period_end=? and (vendor <=> ?)', [
        j.kind,
        j.lang,
        j.ps,
        j.pe,
        j.vendor,
    ])
    const [res] = (await conn.query(
        'insert into reports (kind, lang, vendor, period_start, period_end, title, markdown, created_at) values (?,?,?,?,?,?,?,?)',
        [j.kind, j.lang, j.vendor, j.ps, j.pe, j.title.slice(0, 512), markdown, `${j.pe} ${j.kind === 'daily' ? '23:00:00' : '22:00:00'}`],
    )) as unknown as [{ insertId: number }]
    const reportId = Number(res.insertId)
    if (reportId > 0 && articles.length > 0) {
        await conn.query(
            'insert into report_items (report_id, article_id, `rank`) values ' + articles.map(() => '(?,?,?)').join(','),
            articles.flatMap((a, i) => [reportId, a.id, i + 1]),
        )
    }
    appendFileSync(LOGS[1], `OK ${j.kind}/${j.lang}/${j.vendor ?? 'general'} ${j.ps}~${j.pe} → inline\n`)
    console.log(`saved idx=${idx} reportId=${reportId} items=${articles.length}`)
}

await conn.end()
