import { listReportsCached } from '@entities/report/report.cache'
import { ReportCard } from '@features/report/report-card'
import { ReportFilter } from '@features/report/report-filter'
import { CARD_GRID } from '@lib/constants'
import type { Lang } from '@entities/source/provider.type'
import type { ReportKind } from '@entities/report/report.repo'
import { Suspense } from 'react'

const Page = async ({ searchParams }: { searchParams: Promise<{ kind?: string; lang?: string }> }) => {
    const sp = await searchParams
    const kind: ReportKind = sp.kind === 'weekly' ? 'weekly' : 'daily'
    const lang = sp.lang === 'ja' || sp.lang === 'en' ? (sp.lang as Lang) : 'ko'
    const reports = await listReportsCached('none', kind, lang)

    return (
        <div className='flex flex-col gap-3 py-2'>
            <h1 className='text-2xl font-bold'>리포트</h1>
            <Suspense>
                <ReportFilter />
            </Suspense>
            {reports.length > 0 ? (
                <div className={CARD_GRID}>
                    {reports.map((r) => (
                        <ReportCard key={r.id} report={r} />
                    ))}
                </div>
            ) : (
                <p className='text-muted-foreground py-16 text-center'>조건에 맞는 리포트가 없습니다.</p>
            )}
        </div>
    )
}

export default Page
