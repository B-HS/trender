import {
  mysqlTable,
  bigint,
  varchar,
  text,
  mysqlEnum,
  timestamp,
  datetime,
  int,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/mysql-core"

export const sourceKind = ["keyword", "web"] as const
export const sourceStage = ["candidate", "active", "demoted"] as const
export const lang = ["ko", "ja", "en"] as const
export const reportKind = ["daily", "weekly", "monthly"] as const

export const sources = mysqlTable(
  "sources",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    kind: mysqlEnum("kind", sourceKind).notNull(),
    value: varchar("value", { length: 512 }).notNull(),
    stage: mysqlEnum("stage", sourceStage).notNull().default("candidate"),
    lang: mysqlEnum("lang", lang),
    promotedAt: datetime("promoted_at"),
    lastUsedAt: datetime("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqValue: uniqueIndex("uniq_kind_value").on(t.kind, t.value),
    stageIdx: index("idx_stage").on(t.stage),
  }),
)

export const articles = mysqlTable(
  "articles",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    sourceId: bigint("source_id", { mode: "number" })
      .notNull()
      .references(() => sources.id),
    url: varchar("url", { length: 768 }).notNull(),
    lang: mysqlEnum("lang", lang).notNull(),
    titleOriginal: varchar("title_original", { length: 512 }).notNull(),
    contentOriginal: text("content_original"),
    titleKo: varchar("title_ko", { length: 512 }),
    summaryKo: text("summary_ko"),
    publishedAt: datetime("published_at"),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqUrl: uniqueIndex("uniq_url").on(t.url),
    publishedIdx: index("idx_published").on(t.publishedAt),
    sourceIdx: index("idx_source").on(t.sourceId),
  }),
)

export const keywordsExtracted = mysqlTable(
  "keywords_extracted",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    articleId: bigint("article_id", { mode: "number" })
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    keywordKo: varchar("keyword_ko", { length: 128 }).notNull(),
    keywordOriginal: varchar("keyword_original", { length: 128 }),
    score: int("score").notNull().default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    articleIdx: index("idx_article").on(t.articleId),
    keywordIdx: index("idx_keyword").on(t.keywordKo),
  }),
)

export const reports = mysqlTable(
  "reports",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    kind: mysqlEnum("kind", reportKind).notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    titleKo: varchar("title_ko", { length: 512 }).notNull(),
    markdownKo: text("markdown_ko").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqPeriod: uniqueIndex("uniq_kind_period").on(t.kind, t.periodStart, t.periodEnd),
    createdIdx: index("idx_created").on(t.createdAt),
  }),
)

export const reportItems = mysqlTable(
  "report_items",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    reportId: bigint("report_id", { mode: "number" })
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    articleId: bigint("article_id", { mode: "number" })
      .notNull()
      .references(() => articles.id),
    rank: int("rank").notNull(),
  },
  (t) => ({
    reportIdx: index("idx_report").on(t.reportId),
    articleIdx: index("idx_article").on(t.articleId),
  }),
)

export const sourceStats = mysqlTable(
  "source_stats",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    sourceId: bigint("source_id", { mode: "number" })
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    hitCount: int("hit_count").notNull().default(0),
    adoptionCount: int("adoption_count").notNull().default(0),
  },
  (t) => ({
    uniqDay: uniqueIndex("uniq_source_date").on(t.sourceId, t.date),
    dateIdx: index("idx_date").on(t.date),
  }),
)

export type Source = typeof sources.$inferSelect
export type NewSource = typeof sources.$inferInsert
export type Article = typeof articles.$inferSelect
export type NewArticle = typeof articles.$inferInsert
export type KeywordExtracted = typeof keywordsExtracted.$inferSelect
export type Report = typeof reports.$inferSelect
export type NewReport = typeof reports.$inferInsert
export type ReportItem = typeof reportItems.$inferSelect
export type SourceStat = typeof sourceStats.$inferSelect
