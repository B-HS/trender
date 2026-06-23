'use server'

import { unstable_cache } from 'next/cache'
import { listArticles } from './article.repo'
import type { Lang, Vendor } from '@entities/source/provider.type'

const listCached = unstable_cache(
    (vendor: string, q: string, lang: string, cursor: number) =>
        listArticles({
            vendor: vendor as Vendor | 'none' | 'any',
            q: q || undefined,
            lang: (lang || undefined) as Lang | undefined,
            cursor: cursor || undefined,
            limit: 20,
        }),
    ['article-list'],
    { revalidate: 1800, tags: ['articles'] },
)

export const loadArticles = async ({ vendor, q, lang, cursor }: { vendor: string; q: string; lang: string; cursor: number }) => {
    const items = await listCached(vendor, q, lang, cursor)
    return { items, nextCursor: items.length === 20 ? items[items.length - 1].id : null }
}
