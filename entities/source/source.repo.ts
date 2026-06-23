import { and, eq, sql } from 'drizzle-orm'
import { db } from '@entities/db/client'
import { sources } from '@entities/db/schema'
import type { Provider } from './provider.type'

export const ensureSource = async (provider: Provider) => {
    await db
        .insert(sources)
        .values({ kind: provider.sourceKind, value: provider.value, lang: provider.lang, vendor: provider.vendor, stage: 'active' })
        .onDuplicateKeyUpdate({ set: { lang: provider.lang, vendor: provider.vendor, lastUsedAt: sql`(now())` } })

    const [row] = await db
        .select({ id: sources.id })
        .from(sources)
        .where(and(eq(sources.kind, provider.sourceKind), eq(sources.value, provider.value)))
        .limit(1)
    return row.id
}
