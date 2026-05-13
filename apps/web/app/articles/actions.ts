'use server'

import { and, desc, eq, like, lt, or, type SQL } from 'drizzle-orm'
import { articles, sources } from '@workspace/db'
import { db } from '@/lib/db'

export type ArticleCursor = { fetchedAt: string; id: number }
export type Lang = 'ko' | 'ja' | 'en'

export type ArticleQuery = {
    cursor: ArticleCursor | null
    lang: Lang | null
    sourceId: number | null
    q: string | null
}

export type ArticleRow = {
    id: number
    sourceId: number
    url: string
    lang: Lang
    titleOriginal: string
    titleKo: string | null
    summaryKo: string | null
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
    kind: 'keyword' | 'web'
}

const PAGE_SIZE = 20

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export const loadArticles = async (query: ArticleQuery): Promise<LoadArticlesResult> => {
    const { cursor, lang, sourceId, q } = query
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
        const pattern = `%${escapeLike(q.trim())}%`
        const search = or(like(articles.titleOriginal, pattern), like(articles.titleKo, pattern), like(articles.summaryKo, pattern))
        if (search) conds.push(search)
    }

    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds)

    const rows = await db
        .select({
            id: articles.id,
            sourceId: articles.sourceId,
            url: articles.url,
            lang: articles.lang,
            titleOriginal: articles.titleOriginal,
            titleKo: articles.titleKo,
            summaryKo: articles.summaryKo,
            publishedAt: articles.publishedAt,
            fetchedAt: articles.fetchedAt,
        })
        .from(articles)
        .where(where)
        .orderBy(desc(articles.fetchedAt), desc(articles.id))
        .limit(PAGE_SIZE + 1)

    const hasMore = rows.length > PAGE_SIZE
    const sliced = hasMore ? rows.slice(0, PAGE_SIZE) : rows

    const items: ArticleRow[] = sliced.map((r) => ({
        id: r.id,
        sourceId: r.sourceId,
        url: r.url,
        lang: r.lang,
        titleOriginal: r.titleOriginal,
        titleKo: r.titleKo,
        summaryKo: r.summaryKo,
        publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
        fetchedAt: new Date(r.fetchedAt).toISOString(),
    }))

    const last = items[items.length - 1]
    const nextCursor = hasMore && last ? { fetchedAt: last.fetchedAt, id: last.id } : null

    return { items, nextCursor }
}

export const loadActiveSources = async (): Promise<SourceOption[]> => {
    const rows = await db
        .select({ id: sources.id, value: sources.value, kind: sources.kind })
        .from(sources)
        .where(eq(sources.stage, 'active'))
        .orderBy(sources.kind, sources.value)
    return rows.map((r) => ({ id: r.id, label: r.value, kind: r.kind }))
}
