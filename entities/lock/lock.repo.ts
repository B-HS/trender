import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { db } from '@entities/db/client'
import { appLocks } from '@entities/db/schema'

export const acquireLock = async (name: string, ttlMinutes: number) => {
    await db.insert(appLocks).values({ name, lockedUntil: null }).onDuplicateKeyUpdate({ set: { name } })
    const [res] = await db
        .update(appLocks)
        .set({ lockedUntil: sql`(now() + interval ${sql.raw(String(ttlMinutes))} minute)` })
        .where(and(eq(appLocks.name, name), or(isNull(appLocks.lockedUntil), lt(appLocks.lockedUntil, sql`now()`))))
    return res.affectedRows === 1
}

export const releaseLock = (name: string) => db.update(appLocks).set({ lockedUntil: null }).where(eq(appLocks.name, name))
