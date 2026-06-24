import { PROVIDER_IDS } from '@entities/source/provider-ids'

const ENRICH_PER_RUN = 120
const ENRICH_CONCURRENCY = 6

const crawlOne = async (providerId: string) => {
    'use step'
    const { crawlProviderOnce } = await import('@lib/crawl/pipeline')
    try {
        return await crawlProviderOnce(providerId)
    } catch {
        return 0
    }
}

const getPendingIds = async (limit: number) => {
    'use step'
    const { getPendingArticleIds } = await import('@lib/crawl/pipeline')
    return getPendingArticleIds(limit)
}

const enrichOne = async (articleId: number) => {
    'use step'
    const { enrichArticle } = await import('@lib/crawl/pipeline')
    return enrichArticle(articleId)
}

const chunk = <T>(items: T[], size: number) => {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
    return out
}

export const crawlWorkflow = async () => {
    'use workflow'

    const counts = await Promise.all(PROVIDER_IDS.map((id) => crawlOne(id)))
    const crawled = counts.reduce((sum, n) => sum + n, 0)

    const pendingIds = await getPendingIds(ENRICH_PER_RUN)
    let enriched = 0
    for (const batch of chunk(pendingIds, ENRICH_CONCURRENCY)) {
        const results = await Promise.all(batch.map((id) => enrichOne(id)))
        enriched += results.filter(Boolean).length
    }

    return { crawled, enriched }
}
