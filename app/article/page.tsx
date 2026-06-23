import { loadArticles } from '@entities/article/article.action'
import { listSourceOptions } from '@entities/article/article.repo'
import { ArticleSearch } from '@features/article/article-search'
import { ArticleList } from '@widgets/article/article-list'
import { QUERY_KEY } from '@lib/constants'
import { getQueryClient } from '@lib/get-query-client'
import { sourceLabel } from '@lib/utils'
import type { Lang } from '@entities/source/provider.type'
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { Suspense } from 'react'

const Page = async ({ searchParams }: { searchParams: Promise<{ q?: string; lang?: string; source?: string; period?: string }> }) => {
    const sp = await searchParams
    const q = sp.q ?? ''
    const lang = sp.lang ?? 'ko'
    const source = sp.source ?? ''
    const period = sp.period ?? ''

    const queryClient = getQueryClient()
    const [, sourceRows] = await Promise.all([
        queryClient.prefetchInfiniteQuery({
            queryKey: QUERY_KEY.ARTICLE.LIST('none', q, lang, source, period),
            queryFn: ({ pageParam }) => loadArticles({ vendor: 'none', q, lang, source, period, cursor: pageParam as number }),
            initialPageParam: 0,
        }),
        listSourceOptions('none', lang as Lang),
    ])

    const grouped = new Map<string, string[]>()
    for (const s of sourceRows) {
        const label = sourceLabel(s.value)
        grouped.set(label, [...(grouped.get(label) ?? []), String(s.id)])
    }
    const sources = [...grouped.entries()].map(([label, ids]) => ({ value: ids.join(','), label }))

    return (
        <div className='flex flex-col gap-3 py-2'>
            <h1 className='text-2xl font-bold'>기사</h1>
            <Suspense>
                <ArticleSearch sources={sources} />
            </Suspense>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <ArticleList vendor='none' q={q} lang={lang} source={source} period={period} />
            </HydrationBoundary>
        </div>
    )
}

export default Page
