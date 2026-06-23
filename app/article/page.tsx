import { loadArticles } from '@entities/article/article.action'
import { ArticleSearch } from '@features/article/article-search'
import { ArticleList } from '@widgets/article/article-list'
import { Suspense } from 'react'

const Page = async ({ searchParams }: { searchParams: Promise<{ q?: string; lang?: string }> }) => {
    const sp = await searchParams
    const q = sp.q ?? ''
    const lang = sp.lang ?? 'ko'
    const initial = await loadArticles({ vendor: 'none', q, lang, cursor: 0 })

    return (
        <div className='flex flex-col gap-3 py-2'>
            <h1 className='text-2xl font-bold'>기사</h1>
            <Suspense>
                <ArticleSearch />
            </Suspense>
            <ArticleList key={`none-${q}-${lang}`} vendor='none' q={q} lang={lang} initialItems={initial.items} initialCursor={initial.nextCursor} />
        </div>
    )
}

export default Page
