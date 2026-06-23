import { sql } from 'drizzle-orm'
import { bigint, date, datetime, index, int, mediumtext, mysqlEnum, mysqlTable, primaryKey, timestamp, unique, varchar } from 'drizzle-orm/mysql-core'

export const LANGS = ['ko', 'ja', 'en'] as const
export const VENDORS = ['openai', 'anthropic', 'google', 'meta', 'naver', 'kakao'] as const
export const REPORT_KINDS = ['daily', 'weekly'] as const

export const sources = mysqlTable(
    'sources',
    {
        id: bigint({ mode: 'number' }).autoincrement().notNull(),
        kind: mysqlEnum(['keyword', 'web']).notNull(),
        value: varchar({ length: 512 }).notNull(),
        stage: mysqlEnum(['candidate', 'active', 'demoted']).default('candidate').notNull(),
        lang: mysqlEnum(LANGS),
        vendor: mysqlEnum(VENDORS),
        promotedAt: datetime('promoted_at', { mode: 'string' }),
        lastUsedAt: datetime('last_used_at', { mode: 'string' }),
        createdAt: timestamp('created_at', { mode: 'string' })
            .default(sql`(now())`)
            .notNull(),
    },
    (table) => [
        index('idx_stage').on(table.stage),
        index('idx_lang').on(table.lang),
        index('idx_vendor').on(table.vendor),
        primaryKey({ columns: [table.id], name: 'sources_id' }),
        unique('uniq_kind_value').on(table.kind, table.value),
    ],
)

export const articles = mysqlTable(
    'articles',
    {
        id: bigint({ mode: 'number' }).autoincrement().notNull(),
        sourceId: bigint('source_id', { mode: 'number' })
            .notNull()
            .references(() => sources.id),
        url: varchar({ length: 768 }).notNull(),
        lang: mysqlEnum(LANGS).notNull(),
        titleOriginal: varchar('title_original', { length: 512 }).notNull(),
        contentOriginal: mediumtext('content_original'),
        publishedAt: datetime('published_at', { mode: 'string' }),
        fetchedAt: timestamp('fetched_at', { mode: 'string' })
            .default(sql`(now())`)
            .notNull(),
        keywordsExtractedAt: timestamp('keywords_extracted_at', { mode: 'string' }),
        titleTranslatedKo: varchar('title_translated_ko', { length: 512 }),
        contentTranslatedKo: mediumtext('content_translated_ko'),
        translatedAt: timestamp('translated_at', { mode: 'string' }),
    },
    (table) => [
        index('idx_published').on(table.publishedAt),
        index('idx_source').on(table.sourceId),
        index('idx_lang').on(table.lang),
        index('idx_keywords_extracted').on(table.keywordsExtractedAt),
        index('idx_lang_published').on(table.lang, table.publishedAt),
        primaryKey({ columns: [table.id], name: 'articles_id' }),
        unique('uniq_url').on(table.url),
    ],
)

export const keywordsExtracted = mysqlTable(
    'keywords_extracted',
    {
        id: bigint({ mode: 'number' }).autoincrement().notNull(),
        articleId: bigint('article_id', { mode: 'number' })
            .notNull()
            .references(() => articles.id, { onDelete: 'cascade' }),
        keyword: varchar({ length: 191 }).notNull(),
        score: int().default(1).notNull(),
        createdAt: timestamp('created_at', { mode: 'string' })
            .default(sql`(now())`)
            .notNull(),
    },
    (table) => [
        index('idx_article').on(table.articleId),
        index('idx_keyword').on(table.keyword),
        primaryKey({ columns: [table.id], name: 'keywords_extracted_id' }),
    ],
)

export const reports = mysqlTable(
    'reports',
    {
        id: bigint({ mode: 'number' }).autoincrement().notNull(),
        kind: mysqlEnum(REPORT_KINDS).notNull(),
        lang: mysqlEnum(LANGS).notNull(),
        vendor: mysqlEnum(VENDORS),
        periodStart: date('period_start', { mode: 'string' }).notNull(),
        periodEnd: date('period_end', { mode: 'string' }).notNull(),
        title: varchar({ length: 512 }).notNull(),
        markdown: mediumtext().notNull(),
        createdAt: timestamp('created_at', { mode: 'string' })
            .default(sql`(now())`)
            .notNull(),
        titleTranslatedKo: varchar('title_translated_ko', { length: 512 }),
        markdownTranslatedKo: mediumtext('markdown_translated_ko'),
        translatedAt: timestamp('translated_at', { mode: 'string' }),
    },
    (table) => [
        index('idx_created').on(table.createdAt),
        index('idx_lang_kind').on(table.lang, table.kind),
        index('idx_vendor_kind').on(table.vendor, table.kind),
        primaryKey({ columns: [table.id], name: 'reports_id' }),
        unique('uniq_kind_period_lang').on(table.kind, table.periodStart, table.periodEnd, table.lang),
    ],
)

export const reportItems = mysqlTable(
    'report_items',
    {
        id: bigint({ mode: 'number' }).autoincrement().notNull(),
        reportId: bigint('report_id', { mode: 'number' })
            .notNull()
            .references(() => reports.id, { onDelete: 'cascade' }),
        articleId: bigint('article_id', { mode: 'number' })
            .notNull()
            .references(() => articles.id),
        rank: int().notNull(),
    },
    (table) => [
        index('idx_report').on(table.reportId),
        index('idx_article').on(table.articleId),
        primaryKey({ columns: [table.id], name: 'report_items_id' }),
    ],
)

export const users = mysqlTable(
    'users',
    {
        id: varchar({ length: 36 }).notNull(),
        username: varchar({ length: 64 }).notNull(),
        createdAt: timestamp('created_at', { mode: 'string' })
            .default(sql`(now())`)
            .notNull(),
    },
    (table) => [primaryKey({ columns: [table.id], name: 'users_id' }), unique('uniq_username').on(table.username)],
)

export const sessions = mysqlTable(
    'sessions',
    {
        id: varchar({ length: 64 }).notNull(),
        userId: varchar('user_id', { length: 36 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        expiresAt: datetime('expires_at', { mode: 'string' }).notNull(),
        createdAt: timestamp('created_at', { mode: 'string' })
            .default(sql`(now())`)
            .notNull(),
    },
    (table) => [index('idx_session_user').on(table.userId), primaryKey({ columns: [table.id], name: 'sessions_id' })],
)

export const favorites = mysqlTable(
    'favorites',
    {
        id: bigint({ mode: 'number' }).autoincrement().notNull(),
        userId: varchar('user_id', { length: 36 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        targetType: mysqlEnum('target_type', ['article', 'report']).notNull(),
        targetId: bigint('target_id', { mode: 'number' }).notNull(),
        createdAt: timestamp('created_at', { mode: 'string' })
            .default(sql`(now())`)
            .notNull(),
    },
    (table) => [
        index('idx_fav_user').on(table.userId),
        primaryKey({ columns: [table.id], name: 'favorites_id' }),
        unique('uniq_user_target').on(table.userId, table.targetType, table.targetId),
    ],
)

export const sourceStats = mysqlTable(
    'source_stats',
    {
        id: bigint({ mode: 'number' }).autoincrement().notNull(),
        sourceId: bigint('source_id', { mode: 'number' })
            .notNull()
            .references(() => sources.id, { onDelete: 'cascade' }),
        date: date({ mode: 'string' }).notNull(),
        hitCount: int('hit_count').default(0).notNull(),
        adoptionCount: int('adoption_count').default(0).notNull(),
    },
    (table) => [
        index('idx_date').on(table.date),
        primaryKey({ columns: [table.id], name: 'source_stats_id' }),
        unique('uniq_source_date').on(table.sourceId, table.date),
    ],
)
