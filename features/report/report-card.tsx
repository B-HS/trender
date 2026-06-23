import type { ReportListItem } from '@entities/report/report.repo'
import { BookmarkButton } from '@features/common/bookmark-button'
import { VENDOR_LABEL } from '@lib/constants'
import { Badge } from '@ui/badge'
import dayjs from 'dayjs'
import Link from 'next/link'
import { FC } from 'react'

export const ReportCard: FC<{ report: ReportListItem }> = ({ report }) => {
    return (
        <article className='min-w-0 p-3 rounded shadow-sm hover:shadow-md transition-all duration-150 flex flex-col gap-1.5 border hover:bg-border/50'>
            <header className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-1.5'>
                    <Badge variant='secondary' className='rounded-xs h-fit px-1'>
                        {report.kind === 'daily' ? '일일' : '주간'}
                    </Badge>
                    {report.vendor && <Badge className='rounded-xs h-fit px-1'>{VENDOR_LABEL[report.vendor]}</Badge>}
                </div>
                <div className='flex items-center gap-1'>
                    <time className='text-xs text-muted-foreground'>{dayjs(report.createdAt).format('YYYY-MM-DD')}</time>
                    <BookmarkButton targetType='report' targetId={report.id} />
                </div>
            </header>
            <Link href={`/report/${report.id}`} prefetch={false} className='text-sm font-bold line-clamp-2 hover:underline break-words'>
                {report.title}
            </Link>
            {report.kind === 'weekly' && (
                <p className='text-xs text-muted-foreground'>
                    {report.periodStart} ~ {report.periodEnd}
                </p>
            )}
        </article>
    )
}
