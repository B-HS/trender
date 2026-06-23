import type { Provider, RawListItem } from '@entities/source/provider.type'
import { fetchText } from '@lib/crawl/fetch'
import { normalizeDate } from '@lib/crawl/factories'
import { parseFeed } from '@lib/crawl/feed'
import { extractNuxtBody } from '@lib/crawl/html'

const FEED_URL = 'https://tech.kakao.com/feed'

export const createKakaoProvider = (): Provider => ({
    id: 'kakaotech',
    name: 'KakaoTech',
    value: FEED_URL,
    lang: 'ko',
    kind: 'vendor',
    vendor: 'kakao',
    sourceKind: 'web',
    strategy: 'feed+article',
    list: async () =>
        parseFeed(await fetchText(FEED_URL)).map<RawListItem>((e) => ({
            url: e.link,
            titleOriginal: e.title,
            lang: 'ko',
            publishedAt: normalizeDate(e.published),
            author: e.author,
            summary: e.summaryHtml,
        })),
    fetchBody: async (item) => {
        const html = await fetchText(item.url)
        return extractNuxtBody(html) ?? item.summary ?? null
    },
})
