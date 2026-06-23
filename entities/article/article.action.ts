'use server'

import { unstable_cache } from 'next/cache'
import { listArticles } from './article.repo'
import type { Lang, Vendor } from '@entities/source/provider.type'

const listCached = unstable_cache(
    (vendor: string, q: string, lang: string, source: string, period: string, cursor: number) =>
        listArticles({
            vendor: vendor as Vendor | 'none' | 'any',
            q: q || undefined,
            lang: (lang || undefined) as Lang | undefined,
            sourceIds: source ? source.split(',').map(Number) : undefined,
            period: (period || undefined) as 'today' | '3d' | '7d' | undefined,
            cursor: cursor || undefined,
            limit: 20,
        }),
    ['article-list'],
    { revalidate: 1800, tags: ['articles'] },
)

export const loadArticles = async ({
    vendor,
    q,
    lang,
    source,
    period,
    cursor,
}: {
    vendor: string
    q: string
    lang: string
    source: string
    period: string
    cursor: number
}) => {
    const items = await listCached(vendor, q, lang, source, period, cursor)
    return { items, nextCursor: items.length === 20 ? items[items.length - 1].id : null }
}
