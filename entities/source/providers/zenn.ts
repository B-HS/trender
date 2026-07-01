import type { Lang, Provider, RawListItem } from '@entities/source/provider.type'
import { fetchJson } from '@lib/crawl/fetch'
import { LANG_TZ, normalizeDate } from '@lib/crawl/factories'

type ZennListResponse = {
    articles: { title: string; slug: string; path: string; published_at: string; user: { username: string } }[]
}

type ZennDetailResponse = { article: { body_html: string } }

export const createZennProvider = (topic: 'ai' | 'llm'): Provider => ({
    id: `zenn-${topic}`,
    name: `Zenn (${topic})`,
    value: `zenn:topic:${topic}`,
    lang: 'ja' as Lang,
    kind: 'web',
    sourceKind: 'keyword',
    strategy: 'api',
    list: async () => {
        const data = await fetchJson<ZennListResponse>(`https://zenn.dev/api/articles?topicname=${topic}&order=latest`)
        return data.articles.map<RawListItem>((a) => ({
            url: `https://zenn.dev${a.path}`,
            titleOriginal: a.title,
            lang: 'ja',
            publishedAt: normalizeDate(a.published_at, LANG_TZ.ja),
            author: a.user.username,
            extra: { slug: a.slug },
        }))
    },
    fetchBody: async (item) => {
        const slug = String(item.extra?.slug ?? '')
        if (!slug) return null
        const data = await fetchJson<ZennDetailResponse>(`https://zenn.dev/api/articles/${slug}`)
        return data.article.body_html ?? null
    },
})
