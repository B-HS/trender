import { VENDOR_LABEL, VENDOR_ORDER } from '@lib/constants'
import { ArticleSearch } from '@features/article/article-search'
import { ArticleList } from '@widgets/article/article-list'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

const Page = async ({ params }: { params: Promise<{ vendor: string }> }) => {
    const { vendor } = await params
    if (!(VENDOR_ORDER as readonly string[]).includes(vendor)) notFound()

    return (
        <div className='flex flex-col gap-3'>
            <h1 className='text-2xl font-bold'>{VENDOR_LABEL[vendor as keyof typeof VENDOR_LABEL]}</h1>
            <Suspense>
                <ArticleSearch showLang={false} />
                <ArticleList vendor={vendor} useLang={false} />
            </Suspense>
        </div>
    )
}

export default Page
