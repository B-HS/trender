import Link from 'next/link'
import type { FC } from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@workspace/ui/components/card'
import type { ArticleRow } from './actions'

const LANG_LABEL: Record<string, string> = { ko: '한국어', ja: '日本語', en: 'English' }
const LOCALE_BY_LANG: Record<string, string> = { ko: 'ko-KR', ja: 'ja-JP', en: 'en-US' }

type ArticleCardProps = {
    article: ArticleRow
}

export const ArticleCard: FC<ArticleCardProps> = ({ article: a }) => {
    const displayDate = a.publishedAt ?? a.fetchedAt
    const locale = LOCALE_BY_LANG[a.lang] ?? 'ko-KR'
    return (
        <Card className='group hover:border-foreground/20 overflow-hidden transition-all duration-200 hover:shadow-sm'>
            <CardHeader className='gap-2 pb-2'>
                <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='secondary' className='font-normal'>
                        {LANG_LABEL[a.lang] ?? a.lang}
                    </Badge>
                    <time className='text-muted-foreground text-xs tabular-nums' dateTime={displayDate}>
                        {new Date(displayDate).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </time>
                </div>
                <CardTitle className='text-base leading-snug'>
                    <Link
                        href={`/articles/${a.id}`}
                        className='wrap-break-word group-hover:text-foreground/90 transition-colors hover:underline'>
                        {a.titleOriginal}
                    </Link>
                </CardTitle>
            </CardHeader>
            {a.keywords.length > 0 ? (
                <CardContent className='flex flex-wrap gap-1.5 pt-0'>
                    {a.keywords.map((k) => (
                        <Badge key={k} variant='outline' className='font-normal'>
                            {k}
                        </Badge>
                    ))}
                </CardContent>
            ) : (
                <CardContent className='text-muted-foreground/50 text-xs italic'>키워드 추출 대기 중</CardContent>
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
