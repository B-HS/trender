import {
    getArticleForEnrichment,
    getExistingUrls,
    insertArticle,
    listPendingArticleIds,
    markEnrichmentFailed,
    saveEnrichment,
} from '@entities/article/article.repo'
import { getProvider } from '@entities/source/registry'
import { ensureSource } from '@entities/source/source.repo'
import { isCodexLimit } from '@lib/ai/codex'
import { extractAndTranslate } from '@lib/ai/enrich'
import { extractKeywords } from '@lib/ai/keywords'
import { runProvider } from './runner'

const PER_PROVIDER_LIMIT = 15
const MAX_AGE_DAYS = 14

const isWithinCutoff = (publishedAt?: string) => {
    if (!publishedAt) return true
    const t = new Date(publishedAt).getTime()
    if (Number.isNaN(t)) return true
    return t >= Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
}

export const crawlProviderOnce = async (providerId: string) => {
    const provider = getProvider(providerId)
    if (!provider) throw new Error(`unknown provider: ${providerId}`)

    const sourceId = await ensureSource(provider)
    const rawList = (await provider.list()).filter((i) => isWithinCutoff(i.publishedAt))
    const existing = await getExistingUrls(rawList.map((i) => i.url))
    const items = await runProvider(provider, { items: rawList, limit: PER_PROVIDER_LIMIT, skipUrl: (url) => existing.has(url) })

    let inserted = 0
    for (const item of items) {
        await insertArticle(sourceId, item)
        inserted += 1
    }
    return inserted
}

export const getPendingArticleIds = (limit: number) => listPendingArticleIds(limit)

export const enrichArticle = async (articleId: number) => {
    const article = await getArticleForEnrichment(articleId)
    if (!article) return 'failed'
    try {
        if (article.lang === 'ko') {
            const keywords = await extractKeywords(article.titleOriginal, article.contentOriginal)
            await saveEnrichment(articleId, { keywords })
        } else {
            const { keywords, titleKo, bodyKo } = await extractAndTranslate(article.titleOriginal, article.contentOriginal)
            await saveEnrichment(articleId, { keywords, titleTranslatedKo: titleKo, contentTranslatedKo: bodyKo })
        }
        return 'ok'
    } catch (error) {
        if (isCodexLimit(error)) return 'limited'
        await markEnrichmentFailed(articleId)
        return 'failed'
    }
}
