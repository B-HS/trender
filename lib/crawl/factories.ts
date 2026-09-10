import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import type { Lang, Provider, RawListItem, Vendor } from '@entities/source/provider.type'
import { extractBySelector } from './html'
import { fetchText } from './fetch'
import { parseFeed } from './feed'

dayjs.extend(utc)
dayjs.extend(timezone)

export const LANG_TZ: Record<Lang, string> = { ko: 'Asia/Seoul', ja: 'Asia/Tokyo', en: 'UTC' }

const HAS_TZ = /(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)/i

export const normalizeDate = (raw?: string, tz = 'UTC') => {
    if (!raw) return undefined
    const trimmed = raw.trim()
    try {
        const parsed = HAS_TZ.test(trimmed) ? dayjs(new Date(trimmed)) : dayjs.tz(trimmed, tz)
        return parsed.isValid() ? parsed.utc().format('YYYY-MM-DD HH:mm:ss') : undefined
    } catch {
        return undefined
    }
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
        publishedAt: normalizeDate(e.published, LANG_TZ[cfg.lang]),
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
