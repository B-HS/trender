'use client'

import { useArticles } from '@entities/article/article.client'
import { ArticleCard } from '@features/article/article-card'
import { CARD_GRID } from '@lib/constants'
import { Spinner } from '@ui/spinner'
import { FC, useEffect, useRef } from 'react'

type ArticleListProps = {
    vendor: string
    q: string
    lang: string
    source: string
    period: string
}

export const ArticleList: FC<ArticleListProps> = ({ vendor, q, lang, source, period }) => {
    const sentinelRef = useRef<HTMLDivElement>(null)
    const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useArticles({ vendor, q, lang, source, period })

    useEffect(() => {
        const el = sentinelRef.current
        if (!el) return
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    if (isLoading)
        return (
            <div className='flex justify-center items-center min-h-40'>
                <Spinner />
            </div>
        )

    const items = data?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <p className='text-center text-muted-foreground py-16'>조건에 맞는 기사가 없습니다.</p>

    return (
        <section className={CARD_GRID}>
            {items.map((article) => (
                <ArticleCard key={article.id} article={article} />
            ))}
            <div ref={sentinelRef} className='col-span-full h-10 flex items-center justify-center'>
                {isFetchingNextPage && <Spinner />}
            </div>
        </section>
    )
}
