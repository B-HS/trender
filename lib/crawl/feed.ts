import { XMLParser } from 'fast-xml-parser'
import { decodeEntities } from '@lib/utils'

export type FeedEntry = {
    title: string
    link: string
    published?: string
    author?: string
    summaryHtml?: string
    contentHtml?: string
    guid?: string
    extra: Record<string, string>
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', processEntities: true, trimValues: true })

const txt = (node: unknown): string => {
    if (node == null) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return txt(node[0])
    if (typeof node === 'object') {
        const obj = node as Record<string, unknown>
        if ('#text' in obj) return txt(obj['#text'])
        if ('@_href' in obj) return txt(obj['@_href'])
    }
    return ''
}

const arr = <T>(node: T | T[] | undefined): T[] => (node == null ? [] : Array.isArray(node) ? node : [node])

const atomLink = (links: unknown): string => {
    const list = arr(links as Record<string, unknown> | Record<string, unknown>[])
    const alt = list.find((l) => (l as Record<string, unknown>)['@_rel'] === 'alternate' || !(l as Record<string, unknown>)['@_rel'])
    return txt(alt ?? list[0])
}

export const parseFeed = (xml: string): FeedEntry[] => {
    const root = parser.parse(xml) as Record<string, Record<string, unknown>>

    if (root.rss) {
        const channel = root.rss.channel as Record<string, unknown>
        return arr(channel.item as Record<string, unknown>[]).map((it) => ({
            title: decodeEntities(txt(it.title)),
            link: txt(it.link),
            published: txt(it.pubDate) || txt(it['dc:date']) || undefined,
            author: txt(it['dc:creator']) || txt(it.author) || undefined,
            summaryHtml: txt(it.description) || undefined,
            contentHtml: txt(it['content:encoded']) || undefined,
            guid: txt(it.guid) || undefined,
            extra: { bookmarkCount: txt(it['hatena:bookmarkcount']) },
        }))
    }

    if (root.feed) {
        return arr(root.feed.entry as Record<string, unknown>[]).map((it) => ({
            title: decodeEntities(txt(it.title)),
            link: atomLink(it.link),
            published: txt(it.published) || txt(it.updated) || undefined,
            author: txt((it.author as Record<string, unknown>)?.name ?? it.author) || undefined,
            summaryHtml: txt(it.summary) || undefined,
            contentHtml: txt(it.content) || undefined,
            guid: txt(it.id) || undefined,
            extra: {},
        }))
    }

    const rdf = root['rdf:RDF']
    if (rdf) {
        return arr(rdf.item as Record<string, unknown>[]).map((it) => ({
            title: decodeEntities(txt(it.title)),
            link: txt(it.link),
            published: txt(it['dc:date']) || undefined,
            author: txt(it['dc:creator']) || undefined,
            summaryHtml: txt(it.description) || undefined,
            contentHtml: txt(it['content:encoded']) || undefined,
            guid: txt(it.link) || undefined,
            extra: { bookmarkCount: txt(it['hatena:bookmarkcount']) },
        }))
    }

    return []
}
