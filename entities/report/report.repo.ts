import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@entities/db/client'
import { articles, reportItems, reports, sources } from '@entities/db/schema'
import type { Lang, Vendor } from '@entities/source/provider.type'

export type ReportKind = 'daily' | 'weekly'

export type ReportListItem = {
    id: number
    kind: ReportKind
    vendor: Vendor | null
    title: string
    periodStart: string
    periodEnd: string
    createdAt: string
}

const titleExpr = sql<string>`coalesce(${reports.title}, ${reports.titleTranslatedKo})`

export const listReports = async ({
    vendor,
    kind,
    lang,
    limit = 30,
}: {
    vendor: Vendor | 'none'
    kind?: ReportKind
    lang?: Lang
    limit?: number
}) => {
    const vendorWhere = vendor === 'none' ? isNull(reports.vendor) : eq(reports.vendor, vendor)
    const where = and(...[vendorWhere, kind ? eq(reports.kind, kind) : undefined, lang ? eq(reports.lang, lang) : undefined].filter(Boolean))
    return db
        .select({
            id: reports.id,
            kind: reports.kind,
            vendor: reports.vendor,
            title: titleExpr,
            periodStart: reports.periodStart,
            periodEnd: reports.periodEnd,
            createdAt: reports.createdAt,
        })
        .from(reports)
        .where(where)
        .orderBy(desc(reports.createdAt))
        .limit(limit)
}

export const getReportItems = async (reportId: number) => {
    const rows = await db
        .select({ rank: reportItems.rank, articleId: reportItems.articleId })
        .from(reportItems)
        .where(eq(reportItems.reportId, reportId))
        .orderBy(reportItems.rank)
    return rows
}

export const getReport = async (id: number) => {
    const [row] = await db
        .select({
            id: reports.id,
            kind: reports.kind,
            vendor: reports.vendor,
            title: titleExpr,
            markdown: sql<string>`coalesce(${reports.markdown}, ${reports.markdownTranslatedKo})`,
            periodStart: reports.periodStart,
            periodEnd: reports.periodEnd,
            createdAt: reports.createdAt,
        })
        .from(reports)
        .where(eq(reports.id, id))
        .limit(1)
    return row ?? null
}

export const getArticlesForPeriod = async ({ vendor, since, limit = 30 }: { vendor: Vendor | 'none'; since: string; limit?: number }) => {
    const vendorWhere = vendor === 'none' ? isNull(sources.vendor) : eq(sources.vendor, vendor)
    return db
        .select({
            id: articles.id,
            title: sql<string>`coalesce(${articles.titleTranslatedKo}, ${articles.titleOriginal})`,
            url: articles.url,
        })
        .from(articles)
        .innerJoin(sources, eq(articles.sourceId, sources.id))
        .where(and(vendorWhere, gte(articles.fetchedAt, since)))
        .orderBy(desc(articles.id))
        .limit(limit)
}

export const insertReport = async (
    data: { kind: ReportKind; lang: Lang; vendor: Vendor | null; periodStart: string; periodEnd: string; title: string; markdown: string },
    articleIds: number[],
) => {
    const [res] = await db
        .insert(reports)
        .values({ ...data, vendor: data.vendor ?? undefined })
        .onDuplicateKeyUpdate({ set: { title: data.title, markdown: data.markdown, createdAt: sql`(now())` } })
    const reportId = Number(res.insertId)
    if (reportId > 0 && articleIds.length > 0) {
        await db.insert(reportItems).values(articleIds.map((articleId, idx) => ({ reportId, articleId, rank: idx + 1 })))
    }
    return reportId
}

export const getLatestDailyReports = async (vendor: Vendor | 'none', limit = 6) => listReports({ vendor, kind: 'daily', limit })

export const listVendorReports = async (kind: ReportKind, lang?: Lang, limit = 12) =>
    db
        .select({
            id: reports.id,
            kind: reports.kind,
            vendor: reports.vendor,
            title: titleExpr,
            periodStart: reports.periodStart,
            periodEnd: reports.periodEnd,
            createdAt: reports.createdAt,
        })
        .from(reports)
        .where(and(eq(reports.kind, kind), sql`${reports.vendor} is not null`, lang ? eq(reports.lang, lang) : undefined))
        .orderBy(desc(reports.createdAt))
        .limit(limit)

export const getDailyVendorReports = async (limit = 12) => listVendorReports('daily', undefined, limit)
