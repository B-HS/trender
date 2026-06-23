'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEY } from '@lib/constants'

type Me = { user: { id: string; username: string } | null }

export const useMe = () =>
    useQuery<Me>({
        queryKey: QUERY_KEY.AUTH.ME,
        queryFn: async () => {
            const res = await fetch('/api/auth/me')
            return res.json()
        },
    })

export const useLogin = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (username: string) => {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ username }),
            })
            if (!res.ok) throw new Error('login failed')
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY.AUTH.ME }),
    })
}

export const useLogout = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
        },
        onSuccess: () => queryClient.invalidateQueries(),
    })
}
