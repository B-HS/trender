import { PROVIDER_IDS } from '@entities/source/provider-ids'

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

export const crawlWorkflow = async () => {
    'use workflow'

    if (!(await acquireCrawlLock())) return { skipped: true, crawled: 0 }

    try {
        const counts = await Promise.all(PROVIDER_IDS.map((id) => crawlOne(id)))
        return { skipped: false, crawled: counts.reduce((sum, n) => sum + n, 0) }
    } finally {
        await releaseCrawlLock()
    }
}
