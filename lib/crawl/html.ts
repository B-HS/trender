import * as cheerio from 'cheerio'
import { fetchText } from './fetch'

export const extractBySelector = async (url: string, selectors: string[]) => {
    const html = await fetchText(url)
    const $ = cheerio.load(html)
    $('script, style, noscript, iframe').remove()
    let best: { html: string; len: number } | null = null
    for (const sel of selectors) {
        $(sel).each((_, node) => {
            const el = $(node)
            const len = el.text().trim().length
            if (len > 0 && (!best || len > best.len)) best = { html: el.html()?.trim() ?? '', len }
        })
    }
    return best ? (best as { html: string }).html : null
}

export const extractNuxtBody = (html: string) => {
    const match = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)
    if (!match) return null
    try {
        const payload = JSON.parse(match[1]) as unknown[]
        const htmlish = (payload.filter((x) => typeof x === 'string') as string[])
            .filter((s) => /<\/?(p|h2|h3|figure|pre|ul|img)\b/i.test(s))
            .sort((a, b) => b.length - a.length)
        return htmlish[0] ?? null
    } catch {
        return null
    }
}

export const htmlToText = (html: string) => {
    const $ = cheerio.load(html)
    $('script, style').remove()
    return $.root()
        .text()
        .replace(/\s+\n/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
}
