'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ArticleListItem } from '@entities/article/article.repo'
import { QUERY_KEY } from '@lib/constants'

type ArticlePage = { items: ArticleListItem[]; nextCursor: number | null }

export const useArticles = ({ vendor, q, lang }: { vendor: string; q: string; lang: string }) =>
    useInfiniteQuery<ArticlePage>({
        queryKey: QUERY_KEY.ARTICLE.LIST(vendor, q, lang),
        initialPageParam: 0,
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams({ vendor })
            if (pageParam) params.set('cursor', String(pageParam))
            if (q) params.set('q', q)
            if (lang) params.set('lang', lang)
            const res = await fetch(`/api/articles?${params.toString()}`)
            return res.json()
        },
        getNextPageParam: (last) => last.nextCursor,
    })

export const useFavoriteIds = (targetType: 'article' | 'report') =>
    useQuery<number[]>({
        queryKey: QUERY_KEY.FAVORITE.IDS(targetType),
        queryFn: async () => {
            const res = await fetch(`/api/favorites?targetType=${targetType}`)
            const data = (await res.json()) as { ids: number[] }
            return data.ids
        },
    })

export const useToggleFavorite = (targetType: 'article' | 'report') => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ targetId, active }: { targetId: number; active: boolean }) => {
            const res = await fetch('/api/favorites', {
                method: active ? 'POST' : 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ targetType, targetId }),
            })
            if (!res.ok) throw new Error('favorite failed')
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY.FAVORITE.IDS(targetType) }),
    })
}
