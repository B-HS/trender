'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEY } from '@lib/constants'

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
