import { eq, sql } from 'drizzle-orm'
import { db } from '@entities/db/client'
import { articleViews } from '@entities/db/schema'

export const markArticleViewed = async (userId: string, articleId: number) =>
    db
        .insert(articleViews)
        .values({ userId, articleId })
        .onDuplicateKeyUpdate({ set: { viewedAt: sql`(now())` } })

export const listViewedArticleIds = async (userId: string) => {
    const rows = await db.select({ articleId: articleViews.articleId }).from(articleViews).where(eq(articleViews.userId, userId))
    return rows.map((r) => r.articleId)
}
