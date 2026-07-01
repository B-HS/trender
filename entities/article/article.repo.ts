import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
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
    sortAt: string
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
    sourceIds,
    period,
}: {
    vendor: Vendor | 'none' | 'any'
    cursor?: string
    limit?: number
    q?: string
    lang?: Lang
    sourceIds?: number[]
    period?: 'today' | '3d' | '7d'
}) => {
    const vendorWhere = vendor === 'any' ? undefined : vendor === 'none' ? isNull(sources.vendor) : eq(sources.vendor, vendor)
    const sortUtc = sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt} - interval 9 hour)`
    const [cursorAt, cursorId] = cursor ? cursor.split('|') : []
    const cursorWhere = cursor ? sql`(${sortUtc} < ${cursorAt} or (${sortUtc} = ${cursorAt} and ${articles.id} < ${Number(cursorId)}))` : undefined
    const langWhere = lang ? eq(articles.lang, lang) : undefined
    const sourceWhere = sourceIds && sourceIds.length > 0 ? inArray(articles.sourceId, sourceIds) : undefined
    const kstDayStartUtc = sql`(date(utc_timestamp() + interval 9 hour) - interval 9 hour)`
    const kstDayEndUtc = sql`(date(utc_timestamp() + interval 9 hour) + interval 15 hour)`
    const periodDays = period === '3d' ? 3 : period === '7d' ? 7 : undefined
    const periodWhere =
        period === 'today'
            ? sql`(${sortUtc} >= ${kstDayStartUtc} and ${sortUtc} < ${kstDayEndUtc})`
            : periodDays
              ? sql`${sortUtc} >= (utc_timestamp() - interval ${sql.raw(String(periodDays))} day)`
              : undefined
    const keyword = q?.trim()
    const searchWhere = keyword
        ? sql`(${articles.titleOriginal} like ${`%${keyword}%`} or ${articles.titleTranslatedKo} like ${`%${keyword}%`})`
        : undefined
    const where = and(...[vendorWhere, cursorWhere, langWhere, sourceWhere, periodWhere, searchWhere].filter(Boolean))

    const rows = await db
        .select({
            id: articles.id,
            title: articles.titleOriginal,
            url: articles.url,
            sourceName: sources.value,
            vendor: sources.vendor,
            publishedAt: articles.publishedAt,
            sortAt: sql<string>`${sortUtc}`,
        })
        .from(articles)
        .innerJoin(sources, eq(articles.sourceId, sources.id))
        .where(where)
        .orderBy(sql`${sortUtc} desc`, desc(articles.id))
        .limit(limit)

    return withKeywords(rows)
}

export const listSourceOptions = async (vendor: Vendor | 'none' | 'any', lang?: Lang) => {
    const vendorWhere = vendor === 'any' ? undefined : vendor === 'none' ? isNull(sources.vendor) : eq(sources.vendor, vendor)
    const langWhere = lang ? eq(articles.lang, lang) : undefined
    const rows = await db
        .selectDistinct({ id: sources.id, value: sources.value })
        .from(sources)
        .innerJoin(articles, eq(articles.sourceId, sources.id))
        .where(and(...[vendorWhere, langWhere].filter(Boolean)))
        .orderBy(sources.value)
    return rows
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

const ENRICH_MIN_PUBLISHED = '2026-01-01'

export const listPendingArticleIds = async (limit: number) => {
    const rows = await db
        .select({ id: articles.id })
        .from(articles)
        .where(and(isNull(articles.keywordsExtractedAt), gte(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`, ENRICH_MIN_PUBLISHED)))
        .orderBy(desc(articles.id))
        .limit(limit)
    return rows.map((r) => r.id)
}

export const getArticleForEnrichment = async (id: number) => {
    const [row] = await db
        .select({ id: articles.id, lang: articles.lang, titleOriginal: articles.titleOriginal, contentOriginal: articles.contentOriginal })
        .from(articles)
        .where(eq(articles.id, id))
        .limit(1)
    return row ?? null
}

export const saveEnrichment = async (articleId: number, data: { keywords: string[]; titleTranslatedKo?: string; contentTranslatedKo?: string }) => {
    await db
        .update(articles)
        .set({
            titleTranslatedKo: data.titleTranslatedKo ? data.titleTranslatedKo.slice(0, 512) : null,
            contentTranslatedKo: data.contentTranslatedKo ?? null,
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
