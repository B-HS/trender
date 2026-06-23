import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@entities/db/client'
import { articles, keywordsExtracted, sources } from '@entities/db/schema'
import type { CrawledItem, Lang, Vendor } from '@entities/source/provider.type'

export type ArticleListItem = {
    id: number
    title: string
    url: string
    sourceName: string
    vendor: Vendor | null
    publishedAt: string | null
    keywords: string[]
}

const withKeywords = async (rows: Omit<ArticleListItem, 'keywords'>[]) => {
    if (rows.length === 0) return [] as ArticleListItem[]
    const kw = await db
        .select({ articleId: keywordsExtracted.articleId, keyword: keywordsExtracted.keyword })
        .from(keywordsExtracted)
        .where(
            inArray(
                keywordsExtracted.articleId,
                rows.map((r) => r.id),
            ),
        )
    const byArticle = new Map<number, string[]>()
    for (const k of kw) byArticle.set(k.articleId, [...(byArticle.get(k.articleId) ?? []), k.keyword])
    return rows.map((r) => ({ ...r, keywords: byArticle.get(r.id) ?? [] }))
}

export const listArticles = async ({
    vendor,
    cursor,
    limit = 20,
    q,
    lang,
}: {
    vendor: Vendor | 'none' | 'any'
    cursor?: number
    limit?: number
    q?: string
    lang?: Lang
}) => {
    const vendorWhere = vendor === 'any' ? undefined : vendor === 'none' ? isNull(sources.vendor) : eq(sources.vendor, vendor)
    const cursorWhere = cursor ? lt(articles.id, cursor) : undefined
    const langWhere = lang ? eq(articles.lang, lang) : undefined
    const keyword = q?.trim()
    const searchWhere = keyword
        ? sql`(${articles.titleOriginal} like ${`%${keyword}%`} or ${articles.titleTranslatedKo} like ${`%${keyword}%`})`
        : undefined
    const where = and(...[vendorWhere, cursorWhere, langWhere, searchWhere].filter(Boolean))

    const rows = await db
        .select({
            id: articles.id,
            title: articles.titleOriginal,
            url: articles.url,
            sourceName: sources.value,
            vendor: sources.vendor,
            publishedAt: articles.publishedAt,
        })
        .from(articles)
        .innerJoin(sources, eq(articles.sourceId, sources.id))
        .where(where)
        .orderBy(desc(articles.id))
        .limit(limit)

    return withKeywords(rows)
}

export const getArticle = async (id: number) => {
    const [row] = await db
        .select({
            id: articles.id,
            url: articles.url,
            lang: articles.lang,
            titleOriginal: articles.titleOriginal,
            contentOriginal: articles.contentOriginal,
            titleTranslatedKo: articles.titleTranslatedKo,
            contentTranslatedKo: articles.contentTranslatedKo,
            publishedAt: articles.publishedAt,
            sourceName: sources.value,
            vendor: sources.vendor,
        })
        .from(articles)
        .innerJoin(sources, eq(articles.sourceId, sources.id))
        .where(eq(articles.id, id))
        .limit(1)
    if (!row) return null
    const kw = await db.select({ keyword: keywordsExtracted.keyword }).from(keywordsExtracted).where(eq(keywordsExtracted.articleId, id))
    return { ...row, keywords: kw.map((k) => k.keyword) }
}

export const getExistingUrls = async (urls: string[]) => {
    if (urls.length === 0) return new Set<string>()
    const rows = await db.select({ url: articles.url }).from(articles).where(inArray(articles.url, urls))
    return new Set(rows.map((r) => r.url))
}

export const insertArticle = async (sourceId: number, item: CrawledItem) => {
    const [res] = await db.insert(articles).values({
        sourceId,
        url: item.url,
        lang: item.lang,
        titleOriginal: item.titleOriginal.slice(0, 512),
        contentOriginal: item.contentOriginal,
        publishedAt: item.publishedAt,
    })
    return res.insertId
}

export const getPendingEnrichment = async (limit: number) =>
    db
        .select({ id: articles.id, titleOriginal: articles.titleOriginal, contentOriginal: articles.contentOriginal })
        .from(articles)
        .where(isNull(articles.keywordsExtractedAt))
        .orderBy(desc(articles.id))
        .limit(limit)

export const saveEnrichment = async (articleId: number, data: { keywords: string[]; titleTranslatedKo: string; contentTranslatedKo: string }) => {
    await db
        .update(articles)
        .set({
            titleTranslatedKo: data.titleTranslatedKo.slice(0, 512),
            contentTranslatedKo: data.contentTranslatedKo,
            translatedAt: sql`(now())`,
            keywordsExtractedAt: sql`(now())`,
        })
        .where(eq(articles.id, articleId))

    if (data.keywords.length > 0) {
        await db.insert(keywordsExtracted).values(data.keywords.map((keyword) => ({ articleId, keyword })))
    }
}

export const markEnrichmentFailed = async (articleId: number) =>
    db
        .update(articles)
        .set({ keywordsExtractedAt: sql`(now())` })
        .where(eq(articles.id, articleId))
