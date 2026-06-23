'use client'

import { useFavoriteIds, useToggleFavorite } from '@entities/article/article.client'
import { useMe } from '@entities/auth/auth.client'
import { cn } from '@lib/utils'
import { Button } from '@ui/button'
import { Bookmark } from 'lucide-react'
import dynamic from 'next/dynamic'
import { FC } from 'react'
import { toast } from 'sonner'

type BookmarkButtonProps = {
    targetType: 'article' | 'report'
    targetId: number
    className?: string
}

const BookmarkPlaceholder: FC<{ className?: string }> = ({ className }) => (
    <span className={cn('inline-flex size-7 items-center justify-center', className)} aria-hidden>
        <Bookmark className='size-4 text-muted-foreground/40' />
    </span>
)

const BookmarkButtonInner: FC<BookmarkButtonProps> = ({ targetType, targetId, className }) => {
    const { data: me } = useMe()
    const { data: ids = [] } = useFavoriteIds(targetType)
    const toggle = useToggleFavorite(targetType)

    if (!me?.user) return <BookmarkPlaceholder className={className} />

    const active = ids.includes(targetId)

    return (
        <Button
            variant='ghost'
            size='icon'
            className={cn('size-7', className)}
            aria-label={active ? '북마크 해제' : '북마크'}
            onClick={(e) => {
                e.preventDefault()
                toggle.mutate({ targetId, active: !active }, { onError: () => toast.error('북마크 처리에 실패했습니다') })
            }}>
            <Bookmark className={cn('size-4', active && 'fill-current')} />
        </Button>
    )
}

export const BookmarkButton = dynamic(() => Promise.resolve(BookmarkButtonInner), {
    ssr: false,
    loading: () => <BookmarkPlaceholder />,
})
