import Link from 'next/link'
import { notFound } from 'next/navigation'
import { articles, keywordsExtracted, sources, desc, eq } from '@workspace/db'
import { db } from '@/lib/db'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Separator } from '@workspace/ui/components/separator'
import { ArticleBody } from '@/components/article-body'
import { sanitizeArticleHtml } from '@/lib/sanitize'
import { excerpt, stripHtml } from '@/lib/excerpt'

export const dynamic = 'force-dynamic'

export const generateMetadata = async ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const articleId = Number(id)
    if (!Number.isFinite(articleId) || articleId <= 0) return {}
    const [article] = await db
        .select({ title: articles.titleOriginal, content: articles.contentOriginal })
        .from(articles)
        .where(eq(articles.id, articleId))
        .limit(1)
    if (!article) return {}
    return { title: article.title, description: excerpt(stripHtml(article.content ?? ''), 150) }
}

const LANG_LABEL: Record<string, string> = { ko: '한국어', ja: '日本語', en: 'English' }
const LOCALE_BY_LANG: Record<string, string> = { ko: 'ko-KR', ja: 'ja-JP', en: 'en-US' }

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
            contentTranslatedKo: articles.contentTranslatedKo,
            publishedAt: articles.publishedAt,
            fetchedAt: articles.fetchedAt,
            keywordsExtractedAt: articles.keywordsExtractedAt,
            sourceValue: sources.value,
        })
        .from(articles)
        .leftJoin(sources, eq(articles.sourceId, sources.id))
        .where(eq(articles.id, articleId))
        .limit(1)

    const article = rows[0]
    if (!article) notFound()

    const keywords = await db
        .select({ keyword: keywordsExtracted.keyword, score: keywordsExtracted.score })
        .from(keywordsExtracted)
        .where(eq(keywordsExtracted.articleId, article.id))
        .orderBy(desc(keywordsExtracted.score))

    const translatedHtml =
        article.lang !== 'ko' && article.contentTranslatedKo ? sanitizeArticleHtml(article.contentTranslatedKo) : null
    const locale = LOCALE_BY_LANG[article.lang] ?? 'ko-KR'
    const displayDate = article.publishedAt ?? article.fetchedAt
    const displayDateIso = new Date(displayDate).toISOString()
    const formatDateTime = (d: Date | string) =>
        new Date(d).toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

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
                            {article.sourceValue}
                        </Badge>
                    ) : null}
                    <time className='text-muted-foreground text-sm tabular-nums' dateTime={displayDateIso}>
                        {formatDateTime(displayDate)}
                    </time>
                </div>
                <h1 className='text-2xl leading-tight font-semibold sm:text-3xl'>{article.titleOriginal}</h1>
                <div className='flex flex-wrap items-center gap-2 pt-1'>
                    <Button asChild size='sm' variant='outline'>
                        <a href={article.url} target='_blank' rel='noreferrer noopener'>
                            원문 사이트로 이동 ↗
                        </a>
                    </Button>
                </div>
            </div>

            <section className='flex flex-col gap-3'>
                <div className='flex items-baseline gap-2'>
                    <h2 className='text-xl font-semibold'>추출된 키워드</h2>
                    <span className='text-muted-foreground text-sm'>{keywords.length}개</span>
                </div>
                {keywords.length > 0 ? (
                    <div className='flex flex-wrap gap-1.5'>
                        {keywords.map((k) => (
                            <Badge key={k.keyword} variant='outline' className='font-normal'>
                                {k.keyword}
                                <span className='text-muted-foreground/70 ml-1 text-xs'>·{k.score}</span>
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <Card className='border-dashed'>
                        <CardContent className='text-muted-foreground/70 text-sm italic'>
                            {article.keywordsExtractedAt ? '키워드가 비어 있습니다.' : '키워드 추출 대기 중입니다.'}
                        </CardContent>
                    </Card>
                )}
            </section>

            <Separator />

            <section className='flex flex-col gap-3'>
                <div className='flex items-baseline gap-2'>
                    <h2 className='text-xl font-semibold'>본문</h2>
                    {article.contentOriginal ? (
                        <span className='text-muted-foreground text-xs tabular-nums'>
                            {article.contentOriginal.length.toLocaleString('ko-KR')}자
                        </span>
                    ) : null}
                </div>
                {article.contentOriginal ? (
                    <Card className='overflow-hidden'>
                        <CardHeader className='gap-1 pb-3'>
                            <CardTitle className='text-base leading-snug'>{article.titleOriginal}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ArticleBody
                                originalHtml={sanitizeArticleHtml(article.contentOriginal)}
                                translatedHtml={translatedHtml}
                                untranslated={article.lang !== 'ko' && !translatedHtml}
                            />
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
