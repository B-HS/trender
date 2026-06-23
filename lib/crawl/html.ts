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

export const htmlToText = (html: string) => {
    const $ = cheerio.load(html)
    $('script, style').remove()
    return $.root()
        .text()
        .replace(/\s+\n/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
}
