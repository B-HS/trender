'use client'

import { loadArticles } from '@entities/article/article.action'
import type { ArticleListItem } from '@entities/article/article.repo'
import { ArticleCard } from '@features/article/article-card'
import { CARD_GRID } from '@lib/constants'
import { Spinner } from '@ui/spinner'
import { FC, useEffect, useRef, useState } from 'react'

type ArticleListProps = {
    vendor: string
    q: string
    lang: string
    initialItems: ArticleListItem[]
    initialCursor: number | null
}

export const ArticleList: FC<ArticleListProps> = ({ vendor, q, lang, initialItems, initialCursor }) => {
    const sentinelRef = useRef<HTMLDivElement>(null)
    const loadingRef = useRef(false)
    const [items, setItems] = useState(initialItems)
    const [cursor, setCursor] = useState(initialCursor)
    const [isFetching, setIsFetching] = useState(false)

    useEffect(() => {
        const el = sentinelRef.current
        if (!el || cursor == null) return
        const observer = new IntersectionObserver(async (entries) => {
            if (!entries[0].isIntersecting || loadingRef.current || cursor == null) return
            loadingRef.current = true
            setIsFetching(true)
            const page = await loadArticles({ vendor, q, lang, cursor })
            setItems((prev) => [...prev, ...page.items])
            setCursor(page.nextCursor)
            setIsFetching(false)
            loadingRef.current = false
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [vendor, q, lang, cursor])

    if (items.length === 0) return <p className='text-center text-muted-foreground py-16'>조건에 맞는 기사가 없습니다.</p>

    return (
        <section className={CARD_GRID}>
            {items.map((article) => (
                <ArticleCard key={article.id} article={article} />
            ))}
            <div ref={sentinelRef} className='col-span-full h-10 flex items-center justify-center'>
                {isFetching && <Spinner />}
            </div>
        </section>
    )
}
