import { getSessionUser } from '@/lib/auth/session'
import { favorites, and, eq } from '@workspace/db'
import { db } from '@/lib/db'
import { ok, fail } from '@/lib/api.server'

type FavoriteTarget = 'article' | 'report'

const parseBody = async (req: Request) => {
    const body = await req.json().catch(() => null)
    const targetType = body?.targetType
    const targetId = Number(body?.targetId)
    if ((targetType !== 'article' && targetType !== 'report') || !Number.isFinite(targetId)) return null
    return { targetType: targetType as FavoriteTarget, targetId }
}

export const GET = async () => {
    const user = await getSessionUser()
    if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다', 401)
    const rows = await db
        .select({ targetType: favorites.targetType, targetId: favorites.targetId })
        .from(favorites)
        .where(eq(favorites.userId, user.id))
    const result: Record<FavoriteTarget, number[]> = { article: [], report: [] }
    for (const r of rows) result[r.targetType].push(r.targetId)
    return ok(result)
}

export const POST = async (req: Request) => {
    const user = await getSessionUser()
    if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다', 401)
    const input = await parseBody(req)
    if (!input) return fail('INVALID', '잘못된 요청입니다')
    await db
        .insert(favorites)
        .values({ userId: user.id, targetType: input.targetType, targetId: input.targetId })
        .onDuplicateKeyUpdate({ set: { targetId: input.targetId } })
    return ok({ ...input, favorited: true })
}

export const DELETE = async (req: Request) => {
    const user = await getSessionUser()
    if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다', 401)
    const input = await parseBody(req)
    if (!input) return fail('INVALID', '잘못된 요청입니다')
    await db
        .delete(favorites)
        .where(and(eq(favorites.userId, user.id), eq(favorites.targetType, input.targetType), eq(favorites.targetId, input.targetId)))
    return ok({ ...input, favorited: false })
}
