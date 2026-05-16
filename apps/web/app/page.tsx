import Link from 'next/link'
import { and, desc, eq, type SQL } from 'drizzle-orm'
import { reports } from '@workspace/db'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
import { Badge } from '@workspace/ui/components/badge'
import { cn } from '@workspace/ui/lib/utils'

export const dynamic = 'force-dynamic'

const LANGS = ['ko', 'ja', 'en'] as const
type Lang = (typeof LANGS)[number]

const LANG_LABEL: Record<Lang, string> = { ko: '한국어', ja: '日本語', en: 'English' }

const KIND_LABEL: Record<string, Record<Lang, string>> = {
    daily: { ko: '일간', ja: '日次', en: 'Daily' },
    weekly: { ko: '주간', ja: '週次', en: 'Weekly' },
}

const LOCALE_BY_LANG: Record<Lang, string> = { ko: 'ko-KR', ja: 'ja-JP', en: 'en-US' }

const parseLang = (v: string | undefined): Lang => (LANGS.find((l) => l === v) ?? 'ko') as Lang

const stripMarkdown = (md: string) =>
    md
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^#+\s*/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/^[-*+]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()

const Page = async ({ searchParams }: { searchParams: Promise<{ lang?: string }> }) => {
    const sp = await searchParams
    const lang = parseLang(sp.lang)
    const locale = LOCALE_BY_LANG[lang]
    const formatDate = (d: Date | string) => new Date(d).toLocaleDateString(locale)

    const conds: SQL[] = [eq(reports.lang, lang)]
    const where = conds.length === 1 ? conds[0] : and(...conds)

    const rows = await db.select().from(reports).where(where).orderBy(desc(reports.createdAt)).limit(50)

    return (
        <div className='flex flex-col gap-6'>
            <div className='flex flex-col gap-2'>
                <h1 className='text-2xl font-semibold sm:text-3xl'>최신 리포트</h1>
                <p className='text-muted-foreground text-sm'>언어별로 따로 생성된 트렌드 리포트입니다.</p>
            </div>
            <div className='flex flex-wrap gap-2'>
                {LANGS.map((l) => (
                    <Link
                        key={l}
                        href={l === 'ko' ? '/' : `/?lang=${l}`}
                        className={cn(
                            'rounded-md border px-3 py-1.5 text-sm transition-colors',
                            l === lang ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground',
                        )}>
                        {LANG_LABEL[l]}
                    </Link>
                ))}
            </div>
            {rows.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                    아직 <span className='font-medium'>{LANG_LABEL[lang]}</span> 리포트가 없습니다. 파서가 한 번 이상 실행되어야 표시됩니다.
                </p>
            ) : (
                <div className='grid gap-3 sm:gap-4'>
                    {rows.map((r) => (
                        <Link key={r.id} href={`/reports/${r.id}`} className='group'>
                            <Card className='transition-colors group-hover:bg-accent'>
                                <CardHeader className='gap-2'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <Badge variant='secondary'>{KIND_LABEL[r.kind]?.[lang] ?? r.kind}</Badge>
                                        <Badge variant='outline'>{LANG_LABEL[lang]}</Badge>
                                        <CardDescription>
                                            {formatDate(r.periodStart)} ~ {formatDate(r.periodEnd)}
                                        </CardDescription>
                                    </div>
                                    <CardTitle className='text-base leading-snug sm:text-lg'>{r.title}</CardTitle>
                                </CardHeader>
                                <CardContent className='text-muted-foreground line-clamp-2 text-sm leading-relaxed'>
                                    {stripMarkdown(r.markdown).slice(0, 240)}
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}

export default Page
