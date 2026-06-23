import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '@entities/db/client'
import { sessions, users } from '@entities/db/schema'

export const ensureUser = async (username: string) => {
    const id = crypto.randomUUID()
    await db.insert(users).values({ id, username }).onDuplicateKeyUpdate({ set: { username } })
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
    return row.id
}

export const createSession = async (userId: string) => {
    const id = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
    await db.insert(sessions).values({ id, userId, expiresAt })
    return id
}

export const getSessionUser = async (sessionId: string) => {
    const [row] = await db
        .select({ id: users.id, username: users.username })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, sql`now()`)))
        .limit(1)
    return row ?? null
}

export const deleteSession = async (sessionId: string) => db.delete(sessions).where(eq(sessions.id, sessionId))
