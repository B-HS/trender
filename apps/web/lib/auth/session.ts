import 'server-only'
import { cookies } from 'next/headers'
import { users, sessions, eq } from '@workspace/db'
import { db } from '@/lib/db'

const COOKIE_NAME = 'trender_session'
const TTL_DAYS = 30
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000

export const createSession = async (username: string) => {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
    let userId = existing[0]?.id
    if (!userId) {
        userId = crypto.randomUUID()
        await db.insert(users).values({ id: userId, username })
    }
    const sessionId = crypto.randomUUID()
    await db.insert(sessions).values({ id: sessionId, userId, expiresAt: new Date(Date.now() + TTL_MS) })
    const jar = await cookies()
    jar.set(COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: TTL_DAYS * 24 * 60 * 60,
        secure: process.env.NODE_ENV === 'production',
    })
    return { id: userId, username }
}

export const validateSession = async (sessionId: string) => {
    const [row] = await db
        .select({ userId: sessions.userId, expiresAt: sessions.expiresAt, username: users.username })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.id, sessionId))
        .limit(1)
    if (!row) return null
    if (new Date(row.expiresAt) < new Date()) {
        await db.delete(sessions).where(eq(sessions.id, sessionId))
        return null
    }
    return { id: row.userId, username: row.username }
}

export const getSessionUser = async () => {
    const jar = await cookies()
    const sessionId = jar.get(COOKIE_NAME)?.value
    if (!sessionId) return null
    return validateSession(sessionId)
}

export const deleteSession = async () => {
    const jar = await cookies()
    const sessionId = jar.get(COOKIE_NAME)?.value
    if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId))
    jar.delete(COOKIE_NAME)
}
