import type { Lang, Provider, RawListItem } from '@entities/source/provider.type'
import { fetchJson } from '@lib/crawl/fetch'
import { normalizeDate } from '@lib/crawl/factories'

type QiitaItem = {
    title: string
    url: string
    created_at: string
    rendered_body: string
    likes_count: number
    stocks_count: number
    user: { id: string }
    tags: { name: string }[]
}

export const createQiitaProvider = (tag: 'ai' | 'llm', minStocks = 30): Provider => ({
    id: `qiita-${tag}`,
    name: `Qiita (${tag})`,
    value: `qiita:tag:${tag}`,
    lang: 'ja' as Lang,
    kind: 'web',
    sourceKind: 'keyword',
    strategy: 'api',
    list: async () => {
        const query = encodeURIComponent(`tag:${tag} stocks:>${minStocks}`)
        const items = await fetchJson<QiitaItem[]>(`https://qiita.com/api/v2/items?query=${query}&per_page=20`)
        return items.map<RawListItem>((it) => ({
            url: it.url,
            titleOriginal: it.title,
            lang: 'ja',
            publishedAt: normalizeDate(it.created_at),
            author: it.user.id,
            content: it.rendered_body,
            extra: { likes: it.likes_count, stocks: it.stocks_count },
        }))
    },
})
