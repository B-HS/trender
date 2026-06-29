import type { ArticleListItem } from '@entities/article/article.repo'
import { BookmarkButton } from '@features/common/bookmark-button'
import { VENDOR_LABEL } from '@lib/constants'
import { formatKstDate } from '@lib/date'
import { decodeEntities, sourceBadges } from '@lib/utils'
import { Badge } from '@ui/badge'
import Link from 'next/link'
import { FC } from 'react'

export const ArticleCard: FC<{ article: ArticleListItem }> = ({ article }) => {
    return (
        <article className='min-w-0 p-3 rounded shadow-sm hover:shadow-md transition-all duration-150 flex flex-col gap-1.5 border hover:bg-border/50'>
            <header className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden'>
                    {article.vendor && <Badge className='rounded-xs h-fit px-1 min-w-0 truncate'>{VENDOR_LABEL[article.vendor]}</Badge>}
                    {sourceBadges(article.sourceName).map((label, i) => (
                        <Badge key={label} variant={i === 0 ? 'secondary' : 'outline'} className='rounded-xs h-fit px-1 min-w-0 truncate'>
                            {label}
                        </Badge>
                    ))}
                </div>
                <div className='flex items-center gap-1 shrink-0'>
                    <time className='text-xs text-muted-foreground'>{formatKstDate(article.publishedAt)}</time>
                    <BookmarkButton targetType='article' targetId={article.id} />
                </div>
            </header>
            <Link href={`/article/${article.id}`} prefetch={false} className='text-sm font-bold line-clamp-2 hover:underline break-words'>
                {decodeEntities(article.title)}
            </Link>
        </article>
    )
}
