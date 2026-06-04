import { notFound } from 'next/navigation'
import Link from 'next/link'
import { reports, reportItems, articles, keywordsExtracted, asc, desc, eq, inArray } from '@workspace/db'
import { db } from '@/lib/db'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Separator } from '@workspace/ui/components/separator'
import { ReportBody } from '@/components/report-body'
import { linkifyCitations } from '@/lib/citations'

export const dynamic = 'force-dynamic'

const LANG_LABEL: Record<string, string> = { ko: '한국어', ja: '日本語', en: 'English' }
const LOCALE_BY_LANG: Record<string, string> = { ko: 'ko-KR', ja: 'ja-JP', en: 'en-US' }

const KIND_LABEL: Record<string, Record<string, string>> = {
    daily: { ko: '일간', ja: '日次', en: 'Daily' },
    weekly: { ko: '주간', ja: '週次', en: 'Weekly' },
}

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const reportId = Number(id)
    if (!Number.isFinite(reportId)) notFound()

    const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1)
    if (!report) notFound()

    const locale = LOCALE_BY_LANG[report.lang] ?? 'ko-KR'
    const formatDate = (d: Date | string) => new Date(d).toLocaleDateString(locale)

    const items = await db
        .select({
            rank: reportItems.rank,
            articleId: articles.id,
            url: articles.url,
            lang: articles.lang,
            titleOriginal: articles.titleOriginal,
            publishedAt: articles.publishedAt,
        })
        .from(reportItems)
        .innerJoin(articles, eq(reportItems.articleId, articles.id))
        .where(eq(reportItems.reportId, reportId))
        .orderBy(asc(reportItems.rank))

    const articleIds = items.map((it) => it.articleId)
    const keywordRows =
        articleIds.length > 0
            ? await db
                  .select({
                      articleId: keywordsExtracted.articleId,
                      keyword: keywordsExtracted.keyword,
                      score: keywordsExtracted.score,
                  })
                  .from(keywordsExtracted)
                  .where(inArray(keywordsExtracted.articleId, articleIds))
                  .orderBy(desc(keywordsExtracted.score))
            : []

    const keywordsByArticle = new Map<number, { keyword: string; score: number }[]>()
    for (const k of keywordRows) {
        const list = keywordsByArticle.get(k.articleId) ?? []
        if (list.length < 8) list.push({ keyword: k.keyword, score: k.score })
        keywordsByArticle.set(k.articleId, list)
    }

    const articleIdByRank = new Map(items.map((it) => [it.rank, it.articleId]))
    const linkedMarkdown = linkifyCitations(report.markdown, articleIdByRank)
    const translatedMarkdown =
        report.lang !== 'ko' && report.markdownTranslatedKo ? linkifyCitations(report.markdownTranslatedKo, articleIdByRank) : null

    return (
        <div className='flex flex-col gap-8 sm:gap-10'>
            <div className='flex flex-col gap-3'>
                <Link href={report.lang === 'ko' ? '/' : `/?lang=${report.lang}`} className='text-muted-foreground w-fit text-sm hover:underline'>
                    ← 리포트 목록
                </Link>
                <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='secondary'>{KIND_LABEL[report.kind]?.[report.lang] ?? report.kind}</Badge>
                    <Badge variant='outline'>{LANG_LABEL[report.lang] ?? report.lang}</Badge>
                    <span className='text-muted-foreground text-sm'>
                        {formatDate(report.periodStart)} ~ {formatDate(report.periodEnd)}
                    </span>
                </div>
                <h1 className='text-2xl leading-tight font-semibold sm:text-3xl'>{report.title}</h1>
            </div>

            <ReportBody
                originalMarkdown={linkedMarkdown}
                translatedMarkdown={translatedMarkdown}
                untranslated={report.lang !== 'ko' && !report.markdownTranslatedKo}
            />

            <Separator />

            <section className='flex flex-col gap-4'>
                <div className='flex items-baseline gap-2'>
                    <h2 className='text-xl font-semibold'>채택 기사</h2>
                    <span className='text-muted-foreground text-sm'>{items.length}건</span>
                </div>
                <div className='flex flex-col gap-3'>
                    {items.map((it) => {
                        const kws = keywordsByArticle.get(it.articleId) ?? []
                        return (
                            <Card key={it.rank} className='overflow-hidden'>
                                <CardHeader className='gap-2 pb-2'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <Badge variant='outline'>#{it.rank}</Badge>
                                        <Badge variant='secondary'>{LANG_LABEL[it.lang] ?? it.lang}</Badge>
                                        {it.publishedAt ? (
                                            <span className='text-muted-foreground text-xs tabular-nums'>{formatDate(it.publishedAt)}</span>
                                        ) : null}
                                    </div>
                                    <CardTitle className='text-base leading-snug sm:text-lg'>
                                        <Link href={`/articles/${it.articleId}`} className='wrap-break-word hover:underline'>
                                            {it.titleOriginal}
                                        </Link>
                                    </CardTitle>
                                </CardHeader>
                                {kws.length > 0 ? (
                                    <CardContent className='flex flex-wrap gap-1.5 pt-0'>
                                        {kws.map((k) => (
                                            <Badge key={k.keyword} variant='outline' className='font-normal'>
                                                {k.keyword}
                                            </Badge>
                                        ))}
                                    </CardContent>
                                ) : null}
                            </Card>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}

export default Page
