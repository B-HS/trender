import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listViewedArticleIds, markArticleViewed } from '@entities/view/view.repo'
import { getCurrentUser } from '@lib/auth/session'

const schema = z.object({ articleId: z.number().int().positive() })

export const GET = async () => {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ ids: [] })
    return NextResponse.json({ ids: await listViewedArticleIds(user.id) })
}

export const POST = async (request: Request) => {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 })
    await markArticleViewed(user.id, parsed.data.articleId)
    return NextResponse.json({ ok: true })
}
