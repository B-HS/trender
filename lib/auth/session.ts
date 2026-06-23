import { cookies } from 'next/headers'
import { getSessionUser } from '@entities/auth/auth.repo'

export const SESSION_COOKIE = 'tt_session'

export const getCurrentUser = async () => {
    const store = await cookies()
    const sessionId = store.get(SESSION_COOKIE)?.value
    if (!sessionId) return null
    return getSessionUser(sessionId)
}
