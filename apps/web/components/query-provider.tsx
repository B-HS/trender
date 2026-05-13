'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type FC, type PropsWithChildren } from 'react'

const createClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60_000,
                gcTime: 5 * 60_000,
                refetchOnWindowFocus: false,
                retry: 1,
            },
        },
    })

export const QueryProvider: FC<PropsWithChildren> = ({ children }) => {
    const [client] = useState(createClient)
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
