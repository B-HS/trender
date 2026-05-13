import { count } from 'drizzle-orm'
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { articles } from '@workspace/db'
import { db } from '@/lib/db'
import { ArticlesView } from './articles-view'
import { loadActiveSources, loadArticles, type Lang } from './actions'

export const dynamic = 'force-dynamic'

const LANGS: readonly Lang[] = ['ko', 'ja', 'en'] as const
const parseLang = (v: string | undefined): Lang | null => (LANGS.find((l) => l === v) ?? null)
const parseSourceId = (v: string | undefined): number | null => {
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
}
const parseQ = (v: string | undefined): string | null => {
    const t = v?.trim()
    return t ? t : null
}

const Page = async ({ searchParams }: { searchParams: Promise<{ lang?: string; source?: string; q?: string }> }) => {
    const sp = await searchParams
    const lang = parseLang(sp.lang)
    const sourceId = parseSourceId(sp.source)
    const q = parseQ(sp.q)

    const queryClient = new QueryClient()
    const [, sourceOptions, totalRow] = await Promise.all([
        queryClient.prefetchInfiniteQuery({
            queryKey: ['articles', { lang, sourceId, q }] as const,
            queryFn: () => loadArticles({ cursor: null, lang, sourceId, q }),
            initialPageParam: null,
        }),
        loadActiveSources(),
        db.select({ value: count() }).from(articles),
    ])
    const total = totalRow[0]?.value ?? 0

    return (
        <div className='flex flex-col gap-6'>
            <header className='flex flex-col gap-1'>
                <h1 className='text-2xl font-semibold sm:text-3xl'>수집된 기사</h1>
                <p className='text-muted-foreground text-sm'>한·일·영 트렌드 기사를 검색·필터링할 수 있습니다.</p>
            </header>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <ArticlesView initialQuery={{ lang, sourceId, q }} sourceOptions={sourceOptions} totalCount={total} />
            </HydrationBoundary>
        </div>
    )
}

export default Page
