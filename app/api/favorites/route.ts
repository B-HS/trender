import { NextResponse } from 'next/server'
import { z } from 'zod'
import { addFavorite, listFavoriteIds, removeFavorite } from '@entities/favorite/favorite.repo'
import { getCurrentUser } from '@lib/auth/session'

const schema = z.object({ targetType: z.enum(['article', 'report']), targetId: z.number().int().positive() })

export const GET = async (request: Request) => {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ids: [] })
    const parsed = z.enum(['article', 'report']).safeParse(new URL(request.url).searchParams.get('targetType') ?? 'article')
    if (!parsed.success) return NextResponse.json({ error: 'invalid targetType' }, { status: 400 })
    return NextResponse.json({ ids: await listFavoriteIds(user.id, parsed.data) })
}

export const POST = async (request: Request) => {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 })
    await addFavorite(user.id, parsed.data.targetType, parsed.data.targetId)
    return NextResponse.json({ ok: true })
}

export const DELETE = async (request: Request) => {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 })
    await removeFavorite(user.id, parsed.data.targetType, parsed.data.targetId)
    return NextResponse.json({ ok: true })
}
