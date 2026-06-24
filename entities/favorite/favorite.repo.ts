import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@entities/db/client'
import { articles, favorites, keywordsExtracted, sources } from '@entities/db/schema'
import type { ArticleListItem } from '@entities/article/article.repo'

export type FavoriteTarget = 'article' | 'report'

export const addFavorite = async (userId: string, targetType: FavoriteTarget, targetId: number) =>
    db.insert(favorites).values({ userId, targetType, targetId }).onDuplicateKeyUpdate({ set: { userId } })

export const removeFavorite = async (userId: string, targetType: FavoriteTarget, targetId: number) =>
    db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.targetType, targetType), eq(favorites.targetId, targetId)))

export const listFavoriteIds = async (userId: string, targetType: FavoriteTarget) => {
    const rows = await db
        .select({ targetId: favorites.targetId })
        .from(favorites)
        .where(and(eq(favorites.userId, userId), eq(favorites.targetType, targetType)))
    return rows.map((r) => r.targetId)
}

export const listFavoriteArticles = async (userId: string): Promise<ArticleListItem[]> => {
    const ids = await listFavoriteIds(userId, 'article')
    if (ids.length === 0) return []
    const rows = await db
        .select({
            id: articles.id,
            title: articles.titleOriginal,
            url: articles.url,
            sourceName: sources.value,
            vendor: sources.vendor,
            publishedAt: articles.publishedAt,
            sortAt: sql<string>`coalesce(${articles.publishedAt}, ${articles.fetchedAt})`,
        })
        .from(articles)
        .innerJoin(sources, eq(articles.sourceId, sources.id))
        .where(inArray(articles.id, ids))
        .orderBy(sql`coalesce(${articles.publishedAt}, ${articles.fetchedAt}) desc`, desc(articles.id))
    const kw = await db
        .select({ articleId: keywordsExtracted.articleId, keyword: keywordsExtracted.keyword })
        .from(keywordsExtracted)
        .where(inArray(keywordsExtracted.articleId, ids))
    const byArticle = new Map<number, string[]>()
    for (const k of kw) byArticle.set(k.articleId, [...(byArticle.get(k.articleId) ?? []), k.keyword])
    return rows.map((r) => ({ ...r, keywords: byArticle.get(r.id) ?? [] }))
}
