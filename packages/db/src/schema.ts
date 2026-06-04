import {
    mysqlTable,
    bigint,
    varchar,
    mysqlEnum,
    timestamp,
    datetime,
    int,
    index,
    uniqueIndex,
    date,
    mediumtext,
} from 'drizzle-orm/mysql-core'

export const sourceKind = ['keyword', 'web'] as const
export const sourceStage = ['candidate', 'active', 'demoted'] as const
export const lang = ['ko', 'ja', 'en'] as const
export const reportKind = ['daily', 'weekly'] as const

export const sources = mysqlTable(
    'sources',
    {
        id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
        kind: mysqlEnum('kind', sourceKind).notNull(),
        value: varchar('value', { length: 512 }).notNull(),
        stage: mysqlEnum('stage', sourceStage).notNull().default('candidate'),
        lang: mysqlEnum('lang', lang),
        promotedAt: datetime('promoted_at'),
        lastUsedAt: datetime('last_used_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (t) => ({
        uniqValue: uniqueIndex('uniq_kind_value').on(t.kind, t.value),
        stageIdx: index('idx_stage').on(t.stage),
        langIdx: index('idx_lang').on(t.lang),
    }),
)

export const articles = mysqlTable(
    'articles',
    {
        id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
        sourceId: bigint('source_id', { mode: 'number' })
            .notNull()
            .references(() => sources.id),
        url: varchar('url', { length: 768 }).notNull(),
        lang: mysqlEnum('lang', lang).notNull(),
        titleOriginal: varchar('title_original', { length: 512 }).notNull(),
        contentOriginal: mediumtext('content_original'),
        titleTranslatedKo: varchar('title_translated_ko', { length: 512 }),
        contentTranslatedKo: mediumtext('content_translated_ko'),
        translatedAt: timestamp('translated_at'),
        publishedAt: datetime('published_at'),
        fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
        keywordsExtractedAt: timestamp('keywords_extracted_at'),
    },
    (t) => ({
        uniqUrl: uniqueIndex('uniq_url').on(t.url),
        publishedIdx: index('idx_published').on(t.publishedAt),
        sourceIdx: index('idx_source').on(t.sourceId),
        langIdx: index('idx_lang').on(t.lang),
        kwExtractedIdx: index('idx_keywords_extracted').on(t.keywordsExtractedAt),
        langPublishedIdx: index('idx_lang_published').on(t.lang, t.publishedAt),
    }),
)

export const keywordsExtracted = mysqlTable(
    'keywords_extracted',
    {
        id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
        articleId: bigint('article_id', { mode: 'number' })
            .notNull()
            .references(() => articles.id, { onDelete: 'cascade' }),
        keyword: varchar('keyword', { length: 191 }).notNull(),
        score: int('score').notNull().default(1),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (t) => ({
        articleIdx: index('idx_article').on(t.articleId),
        keywordIdx: index('idx_keyword').on(t.keyword),
    }),
)

export const reports = mysqlTable(
    'reports',
    {
        id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
        kind: mysqlEnum('kind', reportKind).notNull(),
        lang: mysqlEnum('lang', lang).notNull(),
        periodStart: date('period_start').notNull(),
        periodEnd: date('period_end').notNull(),
        title: varchar('title', { length: 512 }).notNull(),
        markdown: mediumtext('markdown').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (t) => ({
        uniqPeriod: uniqueIndex('uniq_kind_period_lang').on(t.kind, t.periodStart, t.periodEnd, t.lang),
        createdIdx: index('idx_created').on(t.createdAt),
        langKindIdx: index('idx_lang_kind').on(t.lang, t.kind),
    }),
)

export const reportItems = mysqlTable(
    'report_items',
    {
        id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
        reportId: bigint('report_id', { mode: 'number' })
            .notNull()
            .references(() => reports.id, { onDelete: 'cascade' }),
        articleId: bigint('article_id', { mode: 'number' })
            .notNull()
            .references(() => articles.id),
        rank: int('rank').notNull(),
    },
    (t) => ({
        reportIdx: index('idx_report').on(t.reportId),
        articleIdx: index('idx_article').on(t.articleId),
    }),
)

export const sourceStats = mysqlTable(
    'source_stats',
    {
        id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
        sourceId: bigint('source_id', { mode: 'number' })
            .notNull()
            .references(() => sources.id, { onDelete: 'cascade' }),
        date: date('date').notNull(),
        hitCount: int('hit_count').notNull().default(0),
        adoptionCount: int('adoption_count').notNull().default(0),
    },
    (t) => ({
        uniqDay: uniqueIndex('uniq_source_date').on(t.sourceId, t.date),
        dateIdx: index('idx_date').on(t.date),
    }),
)

export type Source = typeof sources.$inferSelect
export type NewSource = typeof sources.$inferInsert
export type Article = typeof articles.$inferSelect
export type NewArticle = typeof articles.$inferInsert
export type KeywordExtracted = typeof keywordsExtracted.$inferSelect
export type NewKeywordExtracted = typeof keywordsExtracted.$inferInsert
export type Report = typeof reports.$inferSelect
export type NewReport = typeof reports.$inferInsert
export type ReportItem = typeof reportItems.$inferSelect
export type SourceStat = typeof sourceStats.$inferSelect
