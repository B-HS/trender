'use client'

import { useFavoriteIds, useToggleFavorite } from '@entities/article/article.client'
import { useMe } from '@entities/auth/auth.client'
import { cn } from '@lib/utils'
import { Button } from '@ui/button'
import { Bookmark } from 'lucide-react'
import { FC } from 'react'
import { toast } from 'sonner'

type BookmarkButtonProps = {
    targetType: 'article' | 'report'
    targetId: number
    className?: string
}

export const BookmarkButton: FC<BookmarkButtonProps> = ({ targetType, targetId, className }) => {
    const { data: me } = useMe()
    const { data: ids = [] } = useFavoriteIds(targetType)
    const toggle = useToggleFavorite(targetType)

    const active = ids.includes(targetId)

    if (!me?.user) return null

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
