'use client'

import { useFavoriteIds } from '@entities/article/article.client'
import type { ArticleListItem } from '@entities/article/article.repo'
import { ArticleCard } from '@features/article/article-card'
import { CARD_GRID } from '@lib/constants'
import { FC, useMemo } from 'react'

export const BookmarksList: FC<{ initial: ArticleListItem[] }> = ({ initial }) => {
    const { data: ids } = useFavoriteIds('article')
    const items = useMemo(() => (ids ? initial.filter((a) => ids.includes(a.id)) : initial), [initial, ids])

    if (items.length === 0) return <p className='text-muted-foreground py-16 text-center'>북마크한 기사가 없습니다.</p>

    return (
        <section className={CARD_GRID}>
            {items.map((a) => (
                <ArticleCard key={a.id} article={a} />
            ))}
        </section>
    )
}
