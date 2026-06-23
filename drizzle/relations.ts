import { relations } from "drizzle-orm/relations";
import { sources, articles, users, favorites, keywordsExtracted, reportItems, reports, sessions, sourceStats } from "./schema";

export const articlesRelations = relations(articles, ({one, many}) => ({
	source: one(sources, {
		fields: [articles.sourceId],
		references: [sources.id]
	}),
	keywordsExtracteds: many(keywordsExtracted),
	reportItems: many(reportItems),
}));

export const sourcesRelations = relations(sources, ({many}) => ({
	articles: many(articles),
	sourceStats: many(sourceStats),
}));

export const favoritesRelations = relations(favorites, ({one}) => ({
	user: one(users, {
		fields: [favorites.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	favorites: many(favorites),
	sessions: many(sessions),
}));

export const keywordsExtractedRelations = relations(keywordsExtracted, ({one}) => ({
	article: one(articles, {
		fields: [keywordsExtracted.articleId],
		references: [articles.id]
	}),
}));

export const reportItemsRelations = relations(reportItems, ({one}) => ({
	article: one(articles, {
		fields: [reportItems.articleId],
		references: [articles.id]
	}),
	report: one(reports, {
		fields: [reportItems.reportId],
		references: [reports.id]
	}),
}));

export const reportsRelations = relations(reports, ({many}) => ({
	reportItems: many(reportItems),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const sourceStatsRelations = relations(sourceStats, ({one}) => ({
	source: one(sources, {
		fields: [sourceStats.sourceId],
		references: [sources.id]
	}),
}));