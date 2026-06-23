import type { Lang, Provider, RawListItem, Vendor } from '@entities/source/provider.type'
import { extractBySelector } from './html'
import { fetchText } from './fetch'
import { parseFeed } from './feed'

export const normalizeDate = (raw?: string) => {
    if (!raw) return undefined
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return undefined
    return d.toISOString().slice(0, 19).replace('T', ' ')
}

type FeedConfig = {
    id: string
    name: string
    lang: Lang
    feedUrl: string
    vendor?: Vendor
}

const baseFromConfig = (cfg: FeedConfig) => ({
    id: cfg.id,
    name: cfg.name,
    value: cfg.feedUrl,
    lang: cfg.lang,
    vendor: cfg.vendor,
    kind: (cfg.vendor ? 'vendor' : 'web') as 'web' | 'vendor',
    sourceKind: 'web' as const,
})

const listFromFeed = (cfg: FeedConfig) => async () =>
    parseFeed(await fetchText(cfg.feedUrl)).map<RawListItem>((e) => ({
        url: e.link,
        titleOriginal: e.title,
        lang: cfg.lang,
        publishedAt: normalizeDate(e.published),
        author: e.author,
        summary: e.summaryHtml,
        content: e.contentHtml,
        extra: { ...e.extra, guid: e.guid ?? '' },
    }))

export const createFeedFullProvider = (cfg: FeedConfig): Provider => ({
    ...baseFromConfig(cfg),
    strategy: 'feed-full',
    list: async () => (await listFromFeed(cfg)()).map((item) => ({ ...item, content: item.content || item.summary })),
})

const listForceBody = (cfg: FeedConfig) => async () => (await listFromFeed(cfg)()).map((item) => ({ ...item, content: undefined }))

export const createArticleProvider = (cfg: FeedConfig & { selectors: string[] }): Provider => ({
    ...baseFromConfig(cfg),
    strategy: 'feed+article',
    list: listForceBody(cfg),
    fetchBody: (item) => extractBySelector(item.url, cfg.selectors),
})

export const createThinFeedProvider = (cfg: FeedConfig): Provider => ({
    ...baseFromConfig(cfg),
    strategy: 'feed-only',
    list: async () => (await listFromFeed(cfg)()).map((item) => ({ ...item, content: item.summary })),
})

export const createMdProvider = (cfg: FeedConfig & { mdBase: string }): Provider => ({
    ...baseFromConfig(cfg),
    strategy: 'feed+md',
    list: listForceBody(cfg),
    fetchBody: async (item) => {
        const guid = String(item.extra?.guid ?? '')
        const id = /[?&]id=(\d+)/.exec(guid)?.[1] ?? /\/(\d+)(?:[/?#]|$)/.exec(guid)?.[1] ?? /[?&]id=(\d+)/.exec(item.url)?.[1]
        if (!id) return item.summary ?? null
        return fetchText(`${cfg.mdBase}/${id}.md`)
    },
})

export const createAggregatorProvider = (cfg: FeedConfig & { selectors: string[] }): Provider => ({
    ...baseFromConfig(cfg),
    strategy: 'aggregator',
    list: listForceBody(cfg),
    fetchBody: async (item) => {
        try {
            return await extractBySelector(item.url, cfg.selectors)
        } catch {
            return item.summary ?? null
        }
    },
})
