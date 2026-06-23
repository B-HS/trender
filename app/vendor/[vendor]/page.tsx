import { loadArticles } from '@entities/article/article.action'
import { VENDOR_LABEL, VENDOR_ORDER } from '@lib/constants'
import { ArticleSearch } from '@features/article/article-search'
import { ArticleList } from '@widgets/article/article-list'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

const Page = async ({ params, searchParams }: { params: Promise<{ vendor: string }>; searchParams: Promise<{ q?: string }> }) => {
    const { vendor } = await params
    if (!(VENDOR_ORDER as readonly string[]).includes(vendor)) notFound()
    const sp = await searchParams
    const q = sp.q ?? ''
    const initial = await loadArticles({ vendor, q, lang: '', cursor: 0 })

    return (
        <div className='flex flex-col gap-3'>
            <h1 className='text-2xl font-bold'>{VENDOR_LABEL[vendor as keyof typeof VENDOR_LABEL]}</h1>
            <Suspense>
                <ArticleSearch showLang={false} />
            </Suspense>
            <ArticleList key={`${vendor}-${q}`} vendor={vendor} q={q} lang='' initialItems={initial.items} initialCursor={initial.nextCursor} />
        </div>
    )
}

export default Page
