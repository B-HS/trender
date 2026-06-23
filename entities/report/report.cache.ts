import { unstable_cache } from 'next/cache'
import type { Lang, Vendor } from '@entities/source/provider.type'
import { listReports, type ReportKind } from './report.repo'

const cached = unstable_cache(
    (vendor: string, kind: string, lang: string) =>
        listReports({
            vendor: vendor as Vendor | 'none',
            kind: (kind || undefined) as ReportKind | undefined,
            lang: (lang || undefined) as Lang | undefined,
            limit: 60,
        }),
    ['reports-list'],
    { revalidate: 1800, tags: ['reports'] },
)

export const listReportsCached = (vendor: Vendor | 'none', kind?: ReportKind, lang?: Lang) => cached(vendor, kind ?? '', lang ?? '')
