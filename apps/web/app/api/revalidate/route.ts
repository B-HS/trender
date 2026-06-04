import { revalidatePath, revalidateTag } from 'next/cache'
import { ok, fail } from '@/lib/api.server'

export const POST = async (req: Request) => {
    const url = new URL(req.url)
    const secret = req.headers.get('x-revalidate-secret') ?? url.searchParams.get('secret')
    if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) return fail('UNAUTHORIZED', '인증 실패', 401)

    const body = (await req.json().catch(() => null)) ?? {}
    const type = body.type ?? url.searchParams.get('type')
    const id = body.id ?? url.searchParams.get('id')
    const tag = body.tag ?? url.searchParams.get('tag')
    const path = body.path ?? url.searchParams.get('path')
    const revalidated: string[] = []

    if (type === 'report' || type === 'article') {
        if (id) {
            revalidateTag(`${type}:${id}`, 'max')
            revalidatePath(`/${type}s/${id}`)
            revalidated.push(`${type}:${id}`, `/${type}s/${id}`)
        } else {
            revalidateTag(type, 'max')
            revalidatePath(`/${type}s/[id]`, 'page')
            revalidated.push(type, `/${type}s/[id]`)
        }
    }
    if (tag) {
        revalidateTag(tag, 'max')
        revalidated.push(tag)
    }
    if (path) {
        revalidatePath(path)
        revalidated.push(path)
    }

    if (revalidated.length === 0) return fail('NO_TARGET', 'type(+id), tag, 또는 path 중 하나를 지정하세요')
    return ok({ revalidated })
}
