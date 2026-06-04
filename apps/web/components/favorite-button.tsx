'use client'
import type { FC } from 'react'
import { BookmarkSimple } from '@phosphor-icons/react'
import { cn } from '@workspace/ui/lib/utils'
import { useAuth } from '@/components/auth/auth-provider'
import { useFavorites, useToggleFavorite, type FavoriteTarget } from '@/hooks/use-favorites'

type FavoriteButtonProps = {
    targetType: FavoriteTarget
    targetId: number
    className?: string
}

export const FavoriteButton: FC<FavoriteButtonProps> = ({ targetType, targetId, className }) => {
    const { me, openLogin } = useAuth()
    const { data: favorites } = useFavorites(Boolean(me))
    const toggle = useToggleFavorite()

    const favorited = favorites?.[targetType]?.includes(targetId) ?? false

    const handleClick = () => {
        if (!me) {
            openLogin()
            return
        }
        toggle.mutate({ targetType, targetId, favorited })
    }

    return (
        <button
            type='button'
            onClick={handleClick}
            aria-pressed={favorited}
            aria-label={favorited ? '책갈피 해제' : '책갈피 추가'}
            className={cn('text-muted-foreground hover:text-foreground inline-flex items-center transition-colors', favorited && 'text-foreground', className)}>
            <BookmarkSimple size={18} weight={favorited ? 'fill' : 'regular'} />
        </button>
    )
}
