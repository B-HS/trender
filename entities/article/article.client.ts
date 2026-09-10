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

export const useViewedIds = () =>
    useQuery<number[]>({
        queryKey: QUERY_KEY.VIEW.IDS,
        queryFn: async () => {
            const res = await fetch('/api/views')
            const data = (await res.json()) as { ids: number[] }
            return data.ids
        },
    })

export const useMarkViewed = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (articleId: number) => {
            const res = await fetch('/api/views', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ articleId }),
            })
            if (!res.ok) throw new Error('view failed')
        },
        onMutate: (articleId) => {
            const prev = queryClient.getQueryData<number[]>(QUERY_KEY.VIEW.IDS)
            queryClient.setQueryData<number[]>(QUERY_KEY.VIEW.IDS, (d) => (d?.includes(articleId) ? d : [...(d ?? []), articleId]))
            return { prev }
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(QUERY_KEY.VIEW.IDS, ctx.prev)
        },
    })
}

export const useToggleFavorite = (targetType: 'article' | 'report') => {
    const queryClient = useQueryClient()
    const idsKey = QUERY_KEY.FAVORITE.IDS(targetType)
    return useMutation({
        mutationFn: async ({ targetId, active }: { targetId: number; active: boolean }) => {
            const res = await fetch('/api/favorites', {
                method: active ? 'POST' : 'DELETE',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ targetType, targetId }),
            })
            if (!res.ok) throw new Error('favorite failed')
        },
        onMutate: ({ targetId, active }) => {
            const prev = queryClient.getQueryData<number[]>(idsKey)
            queryClient.setQueryData<number[]>(idsKey, (d) =>
                active ? (d?.includes(targetId) ? d : [...(d ?? []), targetId]) : (d ?? []).filter((x) => x !== targetId),
            )
            return { prev }
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(idsKey, ctx.prev)
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: idsKey }),
    })
}
