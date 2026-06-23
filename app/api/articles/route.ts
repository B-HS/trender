import { NextResponse } from 'next/server'
import { listArticles } from '@entities/article/article.repo'
import type { Lang, Vendor } from '@entities/source/provider.type'

const LANGS = ['ko', 'ja', 'en']

export const GET = async (request: Request) => {
    const { searchParams } = new URL(request.url)
    const vendor = (searchParams.get('vendor') ?? 'none') as Vendor | 'none' | 'any'
    const cursorRaw = searchParams.get('cursor')
    const cursor = cursorRaw ? Number(cursorRaw) : undefined
    const q = searchParams.get('q') ?? undefined
    const langRaw = searchParams.get('lang')
    const lang = langRaw && LANGS.includes(langRaw) ? (langRaw as Lang) : undefined
    const items = await listArticles({ vendor, cursor, limit: 20, q, lang })
    const nextCursor = items.length === 20 ? items[items.length - 1].id : null
    return NextResponse.json({ items, nextCursor })
}
