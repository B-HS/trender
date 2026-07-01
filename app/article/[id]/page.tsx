import { getArticle } from '@entities/article/article.repo'
import { BookmarkButton } from '@features/common/bookmark-button'
import { ContentToggle } from '@features/common/content-toggle'
import { RevalidateButton } from '@features/common/revalidate-button'
import { VENDOR_LABEL } from '@lib/constants'
import { formatKstDate } from '@lib/date'
import { renderContent } from '@lib/render/content'
import { decodeEntities, getHostname } from '@lib/utils'
import { Badge } from '@ui/badge'
import { buttonVariants } from '@ui/button'
import { ExternalLink } from 'lucide-react'
import { notFound } from 'next/navigation'

export const revalidate = 600

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const article = await getArticle(Number(id))
    if (!article) notFound()

    const [originalHtml, translatedHtml] = await Promise.all([renderContent(article.contentOriginal), renderContent(article.contentTranslatedKo)])

    return (
        <article className='flex flex-col gap-4 py-2 max-w-3xl mx-auto'>
            <header className='flex flex-col gap-2'>
                <div className='flex items-center gap-1.5 text-sm text-muted-foreground'>
                    {article.vendor && <Badge className='rounded-xs px-1 shrink-0'>{VENDOR_LABEL[article.vendor]}</Badge>}
                    <span className='truncate min-w-0'>{getHostname(article.url)}</span>
                    {article.publishedAt && <time className='shrink-0 whitespace-nowrap'>· {formatKstDate(article.publishedAt)}</time>}
                </div>
                {article.keywords.length > 0 && (
                    <ul className='flex flex-wrap gap-1'>
                        {article.keywords.map((k) => (
                            <li key={k} className='text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground'>
                                {k}
                            </li>
                        ))}
                    </ul>
                )}
                <div className='flex items-center gap-2'>
                    <a
                        href={article.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit' })}>
                        <ExternalLink className='size-4' />
                        원문 보기
                    </a>
                    <BookmarkButton targetType='article' targetId={article.id} />
                    <RevalidateButton path={`/article/${article.id}`} className='ml-auto' />
                </div>
            </header>
            <ContentToggle
                originalTitle={decodeEntities(article.titleOriginal)}
                translatedTitle={article.titleTranslatedKo ? decodeEntities(article.titleTranslatedKo) : null}
                originalHtml={originalHtml}
                translatedHtml={translatedHtml}
            />
        </article>
    )
}

export default Page
