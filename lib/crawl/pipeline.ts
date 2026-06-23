import { getExistingUrls, getPendingEnrichment, insertArticle, markEnrichmentFailed, saveEnrichment } from '@entities/article/article.repo'
import { getProvider } from '@entities/source/registry'
import { ensureSource } from '@entities/source/source.repo'
import { extractKeywords } from '@lib/ai/keywords'
import { translateToKo } from '@lib/ai/translate'
import { runProvider } from './runner'

const PER_PROVIDER_LIMIT = 15

export const crawlProviderOnce = async (providerId: string) => {
    const provider = getProvider(providerId)
    if (!provider) throw new Error(`unknown provider: ${providerId}`)

    const sourceId = await ensureSource(provider)
    const rawList = await provider.list()
    const existing = await getExistingUrls(rawList.map((i) => i.url))
    const items = await runProvider(provider, { items: rawList, limit: PER_PROVIDER_LIMIT, skipUrl: (url) => existing.has(url) })

    let inserted = 0
    for (const item of items) {
        await insertArticle(sourceId, item)
        inserted += 1
    }
    return inserted
}

export const enrichPendingBatch = async (limit: number) => {
    const pending = await getPendingEnrichment(limit)
    let processed = 0
    for (const article of pending) {
        try {
            const [keywords, translated] = await Promise.all([
                extractKeywords(article.titleOriginal, article.contentOriginal),
                translateToKo(article.titleOriginal, article.contentOriginal),
            ])
            await saveEnrichment(article.id, {
                keywords,
                titleTranslatedKo: translated.titleTranslated,
                contentTranslatedKo: translated.bodyTranslated,
            })
        } catch {
            await markEnrichmentFailed(article.id)
        }
        processed += 1
    }
    return processed
}
