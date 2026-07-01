export const revalidate = 1800

import { listVendorReports } from '@entities/report/report.repo'
import { PageHeader } from '@features/common/page-header'
import { ReportCard } from '@features/report/report-card'
import { CARD_GRID } from '@lib/constants'
import { notFound } from 'next/navigation'

const Page = async ({ params }: { params: Promise<{ kind: string }> }) => {
    const { kind } = await params
    if (kind !== 'daily' && kind !== 'weekly') notFound()

    const reports = await listVendorReports(kind, undefined, 60)

    return (
        <div className='flex flex-col gap-3'>
            <PageHeader title={`${kind === 'daily' ? '일일' : '주간'} 기업 리포트`} revalidatePath={`/vendor/report/${kind}`} />
            {reports.length > 0 ? (
                <div className={CARD_GRID}>
                    {reports.map((r) => (
                        <ReportCard key={r.id} report={r} />
                    ))}
                </div>
            ) : (
                <p className='text-muted-foreground py-16 text-center'>아직 생성된 리포트가 없습니다.</p>
            )}
        </div>
    )
}

export default Page
