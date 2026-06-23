import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { deleteSession } from '@entities/auth/auth.repo'
import { SESSION_COOKIE } from '@lib/auth/session'

export const POST = async () => {
    const store = await cookies()
    const sessionId = store.get(SESSION_COOKIE)?.value
    if (sessionId) await deleteSession(sessionId)
    const res = NextResponse.json({ ok: true })
    res.cookies.delete(SESSION_COOKIE)
    return res
}
