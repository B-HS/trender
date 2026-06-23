export const revalidate = 1800

import { getDailyVendorReports, getLatestDailyReports } from '@entities/report/report.repo'
import { ReportCard } from '@features/report/report-card'
import { CARD_GRID } from '@lib/constants'
import Link from 'next/link'

const Section = ({ title, href, children }: { title: string; href: string; children: React.ReactNode }) => (
    <section className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
            <h2 className='text-xl font-bold'>{title}</h2>
            <Link href={href} className='text-sm text-muted-foreground hover:underline'>
                더보기
            </Link>
        </div>
        {children}
    </section>
)

const Home = async () => {
    const [general, vendor] = await Promise.all([getLatestDailyReports('none', 6), getDailyVendorReports(8)])

    return (
        <div className='flex flex-col gap-8 py-2'>
            <Section title='일반 리포트' href='/report'>
                {general.length > 0 ? (
                    <div className={CARD_GRID}>
                        {general.map((r) => (
                            <ReportCard key={r.id} report={r} />
                        ))}
                    </div>
                ) : (
                    <p className='text-muted-foreground text-sm'>아직 생성된 일반 리포트가 없습니다.</p>
                )}
            </Section>

            <Section title='기업 리포트' href='/vendor/report/daily'>
                {vendor.length > 0 ? (
                    <div className={CARD_GRID}>
                        {vendor.map((r) => (
                            <ReportCard key={r.id} report={r} />
                        ))}
                    </div>
                ) : (
                    <p className='text-muted-foreground text-sm'>아직 생성된 기업 리포트가 없습니다.</p>
                )}
            </Section>
        </div>
    )
}

export default Home
