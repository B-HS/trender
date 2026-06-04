import { createSession } from '@/lib/auth/session'
import { ok, fail } from '@/lib/api.server'

const USERNAME_RE = /^[\w가-힣]{2,20}$/

export const POST = async (req: Request) => {
    const body = await req.json().catch(() => null)
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    if (!USERNAME_RE.test(username)) return fail('INVALID_USERNAME', '아이디는 2~20자(영문·숫자·한글·_)여야 합니다')
    const user = await createSession(username)
    return ok(user)
}
