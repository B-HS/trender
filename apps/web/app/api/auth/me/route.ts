import { getSessionUser } from '@/lib/auth/session'
import { ok, fail } from '@/lib/api.server'

export const GET = async () => {
    const user = await getSessionUser()
    if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다', 401)
    return ok(user)
}
