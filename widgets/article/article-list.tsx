'use client'

import { useArticles } from '@entities/article/article.client'
import { ArticleCard } from '@features/article/article-card'
import { CARD_GRID } from '@lib/constants'
import { Spinner } from '@ui/spinner'
import { useSearchParams } from 'next/navigation'
import { FC, useEffect, useRef } from 'react'

export const ArticleList: FC<{ vendor: string; useLang?: boolean }> = ({ vendor, useLang = true }) => {
    const sentinelRef = useRef<HTMLDivElement>(null)
    const searchParams = useSearchParams()
    const q = searchParams.get('q') ?? ''
    const lang = useLang ? (searchParams.get('lang') ?? 'ko') : ''
    const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useArticles({ vendor, q, lang })

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
    if (items.length === 0) return <p className='text-center text-muted-foreground py-16'>아직 수집된 기사가 없습니다.</p>

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
