import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { articles, sources } from '@workspace/db'
import { db } from '@/lib/db'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Separator } from '@workspace/ui/components/separator'
import { Markdown } from '@/components/markdown'

export const dynamic = 'force-dynamic'

const LANG_LABEL: Record<string, string> = { ko: '한국어', ja: '일본어', en: '영어' }

const formatDateTime = (d: Date | string) =>
    new Date(d).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const articleId = Number(id)
    if (!Number.isFinite(articleId) || articleId <= 0) notFound()

    const rows = await db
        .select({
            id: articles.id,
            url: articles.url,
            lang: articles.lang,
            titleOriginal: articles.titleOriginal,
            contentOriginal: articles.contentOriginal,
            titleKo: articles.titleKo,
            summaryKo: articles.summaryKo,
            publishedAt: articles.publishedAt,
            fetchedAt: articles.fetchedAt,
            sourceKind: sources.kind,
            sourceValue: sources.value,
        })
        .from(articles)
        .leftJoin(sources, eq(articles.sourceId, sources.id))
        .where(eq(articles.id, articleId))
        .limit(1)

    const article = rows[0]
    if (!article) notFound()

    const displayDate = article.publishedAt ?? article.fetchedAt
    const displayDateIso = new Date(displayDate).toISOString()
    const titleKo = article.titleKo
    const hasTranslation = titleKo && titleKo !== article.titleOriginal

    return (
        <div className='flex flex-col gap-8 sm:gap-10'>
            <div className='flex flex-col gap-3'>
                <Link href='/articles' className='text-muted-foreground w-fit text-sm hover:underline'>
                    ← 기사 목록
                </Link>
                <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='secondary'>{LANG_LABEL[article.lang] ?? article.lang}</Badge>
                    {article.sourceValue ? (
                        <Badge variant='outline' className='font-normal'>
                            {article.sourceKind === 'keyword' ? '키워드' : '웹'} · {article.sourceValue}
                        </Badge>
                    ) : null}
                    <time className='text-muted-foreground text-sm tabular-nums' dateTime={displayDateIso}>
                        {formatDateTime(displayDate)}
                    </time>
                </div>
                <h1 className='text-2xl leading-tight font-semibold sm:text-3xl'>{titleKo || article.titleOriginal}</h1>
                {hasTranslation ? <p className='text-muted-foreground text-sm'>{article.titleOriginal}</p> : null}
                <div className='flex flex-wrap items-center gap-2 pt-1'>
                    <Button asChild size='sm' variant='outline'>
                        <a href={article.url} target='_blank' rel='noreferrer noopener'>
                            원문 사이트로 이동 ↗
                        </a>
                    </Button>
                </div>
            </div>

            <section className='flex flex-col gap-3'>
                <h2 className='text-xl font-semibold'>한국어 정리</h2>
                {article.summaryKo ? (
                    <Card>
                        <CardContent>
                            <Markdown source={article.summaryKo} />
                        </CardContent>
                    </Card>
                ) : (
                    <Card className='border-dashed'>
                        <CardContent className='text-muted-foreground/70 text-sm italic'>아직 요약이 생성되지 않았습니다.</CardContent>
                    </Card>
                )}
            </section>

            <Separator />

            <section className='flex flex-col gap-3'>
                <div className='flex items-baseline gap-2'>
                    <h2 className='text-xl font-semibold'>원문</h2>
                    {article.contentOriginal ? (
                        <span className='text-muted-foreground text-xs tabular-nums'>{article.contentOriginal.length.toLocaleString('ko-KR')}자</span>
                    ) : null}
                </div>
                {article.contentOriginal ? (
                    <Card className='overflow-hidden'>
                        <CardHeader className='gap-1 pb-3'>
                            <CardTitle className='text-base leading-snug'>{article.titleOriginal}</CardTitle>
                        </CardHeader>
                        <CardContent className='text-foreground/90 text-sm leading-7 whitespace-pre-wrap'>
                            {article.contentOriginal}
                        </CardContent>
                    </Card>
                ) : (
                    <Card className='border-dashed'>
                        <CardContent className='text-muted-foreground/70 flex flex-col gap-2 text-sm italic'>
                            <span>원문 본문이 수집되지 않았습니다.</span>
                            <a
                                href={article.url}
                                target='_blank'
                                rel='noreferrer noopener'
                                className='text-foreground inline-flex w-fit items-center gap-1 text-xs not-italic underline-offset-2 hover:underline'>
                                원본 사이트에서 보기 ↗
                            </a>
                        </CardContent>
                    </Card>
                )}
            </section>
        </div>
    )
}

export default Page
