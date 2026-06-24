import { PROVIDER_IDS } from '@entities/source/provider-ids'

const ENRICH_PER_RUN = 120
const ENRICH_BATCH = 6
const LOCK_NAME = 'crawl'
const LOCK_TTL_MINUTES = 90

const acquireCrawlLock = async () => {
    'use step'
    const { acquireLock } = await import('@entities/lock/lock.repo')
    return acquireLock(LOCK_NAME, LOCK_TTL_MINUTES)
}

const releaseCrawlLock = async () => {
    'use step'
    const { releaseLock } = await import('@entities/lock/lock.repo')
    await releaseLock(LOCK_NAME)
}

const crawlOne = async (providerId: string) => {
    'use step'
    const { crawlProviderOnce } = await import('@lib/crawl/pipeline')
    try {
        return await crawlProviderOnce(providerId)
    } catch (error) {
        console.error(`crawl failed: ${providerId}`, error instanceof Error ? error.message : error)
        return 0
    }
}

const getPendingIds = async (limit: number) => {
    'use step'
    const { getPendingArticleIds } = await import('@lib/crawl/pipeline')
    return getPendingArticleIds(limit)
}

const enrichBatch = async (articleIds: number[]) => {
    'use step'
    const { enrichArticle } = await import('@lib/crawl/pipeline')
    const results = await Promise.all(articleIds.map((id) => enrichArticle(id)))
    return { enriched: results.filter((r) => r === 'ok').length, limited: results.includes('limited') }
}

const chunk = <T>(items: T[], size: number) => {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
    return out
}

export const crawlWorkflow = async () => {
    'use workflow'

    if (!(await acquireCrawlLock())) return { skipped: true, crawled: 0, enriched: 0, limited: false }

    try {
        const counts = await Promise.all(PROVIDER_IDS.map((id) => crawlOne(id)))
        const crawled = counts.reduce((sum, n) => sum + n, 0)

        const pendingIds = await getPendingIds(ENRICH_PER_RUN)
        let enriched = 0
        let limited = false
        for (const batch of chunk(pendingIds, ENRICH_BATCH)) {
            const result = await enrichBatch(batch)
            enriched += result.enriched
            if (result.limited) {
                limited = true
                break
            }
        }

        return { skipped: false, crawled, enriched, limited }
    } finally {
        await releaseCrawlLock()
    }
}
