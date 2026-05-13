import Link from 'next/link'
import type { FC } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@workspace/ui/components/card'
import type { ArticleRow } from './actions'

const LANG_LABEL: Record<string, string> = { ko: '한국어', ja: '일본어', en: '영어' }

const stripMarkdown = (text: string) =>
    text
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^#+\s*/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/^[-*+]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s*\n+\s*/g, ' ')
        .trim()

type ArticleCardProps = {
    article: ArticleRow
}

export const ArticleCard: FC<ArticleCardProps> = ({ article: a }) => {
    const displayDate = a.publishedAt ?? a.fetchedAt
    return (
        <Card className='group hover:border-foreground/20 overflow-hidden transition-all duration-200 hover:shadow-sm'>
            <CardHeader className='gap-2 pb-2'>
                <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='secondary' className='font-normal'>
                        {LANG_LABEL[a.lang] ?? a.lang}
                    </Badge>
                    <time className='text-muted-foreground text-xs tabular-nums' dateTime={displayDate}>
                        {new Date(displayDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </time>
                </div>
                <CardTitle className='text-base leading-snug'>
                    <Link
                        href={`/articles/${a.id}`}
                        className='wrap-break-word group-hover:text-foreground/90 transition-colors hover:underline'>
                        {a.titleKo || a.titleOriginal}
                    </Link>
                </CardTitle>
                {a.titleKo && a.titleOriginal !== a.titleKo ? (
                    <p className='text-muted-foreground/70 line-clamp-1 text-xs'>{a.titleOriginal}</p>
                ) : null}
            </CardHeader>
            {a.summaryKo ? (
                <CardContent className='text-muted-foreground line-clamp-3 text-sm leading-relaxed'>{stripMarkdown(a.summaryKo)}</CardContent>
            ) : (
                <CardContent className='text-muted-foreground/50 text-xs italic'>아직 요약 대기 중</CardContent>
            )}
            <CardFooter className='flex justify-end pt-2'>
                <a
                    href={a.url}
                    target='_blank'
                    rel='noreferrer noopener'
                    className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors'>
                    원문 보기
                    <span aria-hidden='true'>↗</span>
                </a>
            </CardFooter>
        </Card>
    )
}
