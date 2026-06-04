'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clientFetch } from '@/lib/api.client'
import { QUERY_KEY } from '@/lib/query-keys'

type Me = { id: string; username: string }

export const useMe = () =>
    useQuery<Me | null>({
        queryKey: QUERY_KEY.AUTH.ME,
        queryFn: async () => {
            try {
                return await clientFetch<Me>('/api/auth/me')
            } catch {
                return null
            }
        },
    })

export const useLogin = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (username: string) => clientFetch<Me>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username }) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY.AUTH.ME })
            queryClient.invalidateQueries({ queryKey: QUERY_KEY.FAVORITES.LIST })
        },
    })
}

export const useLogout = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: () => clientFetch('/api/auth/logout', { method: 'POST' }),
        onSuccess: () => {
            queryClient.setQueryData(QUERY_KEY.AUTH.ME, null)
            queryClient.invalidateQueries({ queryKey: QUERY_KEY.FAVORITES.LIST })
        },
    })
}
