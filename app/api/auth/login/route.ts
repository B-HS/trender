import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSession, ensureUser } from '@entities/auth/auth.repo'
import { SESSION_COOKIE } from '@lib/auth/session'

const schema = z.object({ username: z.string().trim().min(1).max(64) })

export const POST = async (request: Request) => {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'invalid username' }, { status: 400 })

    const userId = await ensureUser(parsed.data.username)
    const sessionId = await createSession(userId)
    const res = NextResponse.json({ username: parsed.data.username })
    res.cookies.set(SESSION_COOKIE, sessionId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 })
    return res
}
