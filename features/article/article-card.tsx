import type { ArticleListItem } from '@entities/article/article.repo'
import { BookmarkButton } from '@features/common/bookmark-button'
import { VENDOR_LABEL } from '@lib/constants'
import { Badge } from '@ui/badge'
import dayjs from 'dayjs'
import Link from 'next/link'
import { FC } from 'react'

export const ArticleCard: FC<{ article: ArticleListItem }> = ({ article }) => {
    return (
        <article className='p-3 rounded shadow-sm hover:shadow-md transition-all duration-150 flex flex-col gap-1.5 border hover:bg-border/50'>
            <header className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-1.5 min-w-0'>
                    {article.vendor && <Badge className='rounded-xs h-fit px-1'>{VENDOR_LABEL[article.vendor]}</Badge>}
                    <span className='text-xs text-muted-foreground truncate'>{article.sourceName}</span>
                </div>
                <div className='flex items-center gap-1 shrink-0'>
                    <time className='text-xs text-muted-foreground'>
                        {article.publishedAt ? dayjs(article.publishedAt).format('YYYY-MM-DD') : ''}
                    </time>
                    <BookmarkButton targetType='article' targetId={article.id} />
                </div>
            </header>
            <Link href={`/article/${article.id}`} prefetch={false} className='text-sm font-bold line-clamp-2 hover:underline'>
                {article.title}
            </Link>
            {article.keywords.length > 0 && (
                <ul className='flex flex-wrap gap-1'>
                    {article.keywords.slice(0, 6).map((k) => (
                        <li key={k} className='text-2xs text-muted-foreground bg-muted rounded px-1.5 py-0.5'>
                            {k}
                        </li>
                    ))}
                </ul>
            )}
        </article>
    )
}
