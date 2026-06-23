import { loadArticles } from '@entities/article/article.action'
import { VENDOR_LABEL, VENDOR_ORDER, QUERY_KEY } from '@lib/constants'
import { ArticleSearch } from '@features/article/article-search'
import { ArticleList } from '@widgets/article/article-list'
import { getQueryClient } from '@lib/get-query-client'
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

const Page = async ({ params, searchParams }: { params: Promise<{ vendor: string }>; searchParams: Promise<{ q?: string; period?: string }> }) => {
    const { vendor } = await params
    if (!(VENDOR_ORDER as readonly string[]).includes(vendor)) notFound()
    const sp = await searchParams
    const q = sp.q ?? ''
    const period = sp.period ?? ''

    const queryClient = getQueryClient()
    await queryClient.prefetchInfiniteQuery({
        queryKey: QUERY_KEY.ARTICLE.LIST(vendor, q, '', '', period),
        queryFn: ({ pageParam }) => loadArticles({ vendor, q, lang: '', source: '', period, cursor: pageParam as number }),
        initialPageParam: 0,
    })

    return (
        <div className='flex flex-col gap-3'>
            <h1 className='text-2xl font-bold'>{VENDOR_LABEL[vendor as keyof typeof VENDOR_LABEL]}</h1>
            <Suspense>
                <ArticleSearch showLang={false} />
            </Suspense>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <ArticleList vendor={vendor} q={q} lang='' source='' period={period} />
            </HydrationBoundary>
        </div>
    )
}

export default Page
