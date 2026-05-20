'use server'

import { and, count, desc, eq, inArray, like, lt, or, sql, type SQL } from 'drizzle-orm'
import { articles, keywordsExtracted, sources } from '@workspace/db'
import { db } from '@/lib/db'

export type ArticleCursor = { fetchedAt: string; id: number }
export type Lang = 'ko' | 'ja' | 'en'
export type KeywordMode = 'exact' | 'like'

export type ArticleQuery = {
    cursor: ArticleCursor | null
    lang: Lang | null
    sourceId: number | null
    q: string | null
    keywordMode: KeywordMode
}

export type ArticleRow = {
    id: number
    sourceId: number
    url: string
    lang: Lang
    titleOriginal: string
    keywords: string[]
    publishedAt: string | null
    fetchedAt: string
}

export type LoadArticlesResult = {
    items: ArticleRow[]
    nextCursor: ArticleCursor | null
}

export type SourceOption = {
    id: number
    label: string
}

const PAGE_SIZE = 20
const TOP_KEYWORDS_LIMIT = 18
const TOP_KEYWORDS_WINDOW_DAYS = 14

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export const loadArticles = async (query: ArticleQuery): Promise<LoadArticlesResult> => {
    const { cursor, lang, sourceId, q, keywordMode } = query
    const conds: SQL[] = []

    if (cursor) {
        const cursorCond = or(
            lt(articles.fetchedAt, new Date(cursor.fetchedAt)),
            and(eq(articles.fetchedAt, new Date(cursor.fetchedAt)), lt(articles.id, cursor.id)),
        )
        if (cursorCond) conds.push(cursorCond)
    }
    if (lang) conds.push(eq(articles.lang, lang))
    if (sourceId) conds.push(eq(articles.sourceId, sourceId))
    if (q && q.trim()) {
        const trimmed = q.trim()
        if (keywordMode === 'exact') {
            conds.push(
                sql`EXISTS (SELECT 1 FROM ${keywordsExtracted} ke WHERE ke.article_id = ${articles.id} AND ke.keyword = ${trimmed})`,
            )
        } else {
            const pattern = `%${escapeLike(trimmed)}%`
            const search = or(
                like(articles.titleOriginal, pattern),
                sql`EXISTS (SELECT 1 FROM ${keywordsExtracted} ke WHERE ke.article_id = ${articles.id} AND ke.keyword LIKE ${pattern})`,
            )
            if (search) conds.push(search)
        }
    }

    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds)

    const rows = await db
        .select({
            id: articles.id,
            sourceId: articles.sourceId,
            url: articles.url,
            lang: articles.lang,
            titleOriginal: articles.titleOriginal,
            publishedAt: articles.publishedAt,
            fetchedAt: articles.fetchedAt,
        })
        .from(articles)
        .where(where)
        .orderBy(desc(articles.fetchedAt), desc(articles.id))
        .limit(PAGE_SIZE + 1)

    const hasMore = rows.length > PAGE_SIZE
    const sliced = hasMore ? rows.slice(0, PAGE_SIZE) : rows

    const articleIds = sliced.map((r) => r.id)
    const keywordRows =
        articleIds.length > 0
            ? await db
                  .select({
                      articleId: keywordsExtracted.articleId,
                      keyword: keywordsExtracted.keyword,
                      score: keywordsExtracted.score,
                  })
                  .from(keywordsExtracted)
                  .where(inArray(keywordsExtracted.articleId, articleIds))
                  .orderBy(desc(keywordsExtracted.score))
            : []

    const keywordsByArticle = new Map<number, string[]>()
    for (const k of keywordRows) {
        const list = keywordsByArticle.get(k.articleId) ?? []
        if (list.length < 6) list.push(k.keyword)
        keywordsByArticle.set(k.articleId, list)
    }

    const items: ArticleRow[] = sliced.map((r) => ({
        id: r.id,
        sourceId: r.sourceId,
        url: r.url,
        lang: r.lang,
        titleOriginal: r.titleOriginal,
        keywords: keywordsByArticle.get(r.id) ?? [],
        publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
        fetchedAt: new Date(r.fetchedAt).toISOString(),
    }))

    const last = items[items.length - 1]
    const nextCursor = hasMore && last ? { fetchedAt: last.fetchedAt, id: last.id } : null

    return { items, nextCursor }
}

export const loadActiveSources = async (): Promise<SourceOption[]> => {
    const rows = await db
        .select({ id: sources.id, value: sources.value })
        .from(sources)
        .where(and(eq(sources.stage, 'active'), eq(sources.kind, 'web')))
        .orderBy(sources.value)
    return rows.map((r) => ({ id: r.id, label: r.value }))
}

export const loadTopKeywords = async (lang: Lang | null): Promise<string[]> => {
    const since = sql`(NOW() - INTERVAL ${TOP_KEYWORDS_WINDOW_DAYS} DAY)`
    const conds: SQL[] = [sql`${articles.fetchedAt} >= ${since}`]
    if (lang) conds.push(eq(articles.lang, lang))
    const where = conds.length === 1 ? conds[0] : and(...conds)

    const rows = await db
        .select({ keyword: keywordsExtracted.keyword, freq: count() })
        .from(keywordsExtracted)
        .innerJoin(articles, eq(keywordsExtracted.articleId, articles.id))
        .where(where)
        .groupBy(keywordsExtracted.keyword)
        .orderBy(desc(count()))
        .limit(TOP_KEYWORDS_LIMIT)
    return rows.map((r) => r.keyword)
}
