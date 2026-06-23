import { PROVIDER_IDS } from '@entities/source/provider-ids'

const ENRICH_BATCH = 8
const MAX_ENRICH_ROUNDS = 30

const crawlOne = async (providerId: string) => {
    'use step'
    const { crawlProviderOnce } = await import('@lib/crawl/pipeline')
    return crawlProviderOnce(providerId)
}

const enrichBatch = async (limit: number) => {
    'use step'
    const { enrichPendingBatch } = await import('@lib/crawl/pipeline')
    return enrichPendingBatch(limit)
}

export const crawlWorkflow = async () => {
    'use workflow'

    let crawled = 0
    for (const id of PROVIDER_IDS) {
        try {
            crawled += await crawlOne(id)
        } catch {
            continue
        }
    }

    let enriched = 0
    for (let round = 0; round < MAX_ENRICH_ROUNDS; round += 1) {
        const processed = await enrichBatch(ENRICH_BATCH)
        if (processed === 0) break
        enriched += processed
    }

    return { crawled, enriched }
}
