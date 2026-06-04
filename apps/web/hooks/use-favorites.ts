'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clientFetch } from '@/lib/api.client'
import { QUERY_KEY } from '@/lib/query-keys'

export type FavoriteTarget = 'article' | 'report'
type FavoriteMap = { article: number[]; report: number[] }

export const useFavorites = (enabled: boolean) =>
    useQuery<FavoriteMap>({
        queryKey: QUERY_KEY.FAVORITES.LIST,
        queryFn: () => clientFetch<FavoriteMap>('/api/favorites'),
        enabled,
    })

export const useToggleFavorite = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ targetType, targetId, favorited }: { targetType: FavoriteTarget; targetId: number; favorited: boolean }) =>
            clientFetch('/api/favorites', { method: favorited ? 'DELETE' : 'POST', body: JSON.stringify({ targetType, targetId }) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY.FAVORITES.LIST }),
    })
}
