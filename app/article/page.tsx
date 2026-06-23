export const dynamic = 'force-dynamic'

import { ArticleSearch } from '@features/article/article-search'
import { ArticleList } from '@widgets/article/article-list'
import { Suspense } from 'react'

const Page = () => (
    <div className='flex flex-col gap-3 py-2'>
        <h1 className='text-2xl font-bold'>기사</h1>
        <Suspense>
            <ArticleSearch />
            <ArticleList vendor='none' />
        </Suspense>
    </div>
)

export default Page
