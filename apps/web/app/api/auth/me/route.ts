import { getSessionUser } from '@/lib/auth/session'
import { ok } from '@/lib/api.server'

export const GET = async () => {
    const user = await getSessionUser()
    return ok(user ?? null)
}
