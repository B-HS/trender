import { LANGS, VENDORS } from '@entities/db/schema'

export type Lang = (typeof LANGS)[number]
export type Vendor = (typeof VENDORS)[number]

export type Strategy = 'feed-full' | 'api' | 'feed+article' | 'feed+md' | 'feed-only' | 'aggregator'

export type RawListItem = {
    url: string
    titleOriginal: string
    lang: Lang
    publishedAt?: string
    author?: string
    summary?: string
    content?: string
    extra?: Record<string, string | number>
}

export type CrawledItem = RawListItem & {
    contentOriginal: string | null
}

export type Provider = {
    id: string
    name: string
    value: string
    lang: Lang
    kind: 'web' | 'vendor'
    vendor?: Vendor
    sourceKind: 'web' | 'keyword'
    strategy: Strategy
    list: () => Promise<RawListItem[]>
    fetchBody?: (item: RawListItem) => Promise<string | null>
    dedupKey?: (item: RawListItem) => string
    noiseFilter?: (item: RawListItem) => boolean
}
