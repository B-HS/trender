import { getReport } from '@entities/report/report.repo'
import { BookmarkButton } from '@features/common/bookmark-button'
import { ContentView } from '@features/common/content-view'
import { VENDOR_LABEL } from '@lib/constants'
import { Badge } from '@ui/badge'
import { notFound } from 'next/navigation'

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const report = await getReport(Number(id))
    if (!report) notFound()

    return (
        <article className='flex flex-col gap-4 py-2 max-w-3xl mx-auto'>
            <header className='flex flex-col gap-2'>
                <div className='flex items-center gap-1.5'>
                    <Badge variant='secondary' className='rounded-xs px-1'>
                        {report.kind === 'daily' ? '일일' : '주간'}
                    </Badge>
                    {report.vendor && <Badge className='rounded-xs px-1'>{VENDOR_LABEL[report.vendor]}</Badge>}
                    <span className='text-sm text-muted-foreground'>
                        {report.periodStart} ~ {report.periodEnd}
                    </span>
                </div>
                <div className='flex items-start justify-between gap-2'>
                    <h1 className='text-2xl font-extrabold tracking-tight'>{report.title}</h1>
                    <BookmarkButton targetType='report' targetId={report.id} className='mt-1 shrink-0' />
                </div>
            </header>
            <ContentView content={report.markdown} />
        </article>
    )
}

export default Page
