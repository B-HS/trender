'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { loadArticles } from '@entities/article/article.action'
import { QUERY_KEY } from '@lib/constants'

type ArticleQueryArgs = { vendor: string; q: string; lang: string; source: string; period: string }

export const useArticles = ({ vendor, q, lang, source, period }: ArticleQueryArgs) =>
    useInfiniteQuery({
        queryKey: QUERY_KEY.ARTICLE.LIST(vendor, q, lang, source, period),
        initialPageParam: '',
        queryFn: ({ pageParam }) => loadArticles({ vendor, q, lang, source, period, cursor: pageParam as string }),
        getNextPageParam: (last) => last.nextCursor ?? undefined,
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
