'use client'

import { getQueryClient } from '@lib/get-query-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { FC, PropsWithChildren } from 'react'

export const TanstackQueryProvider: FC<PropsWithChildren> = ({ children }) => {
    const queryClient = getQueryClient()
    return <QueryClientProvider client={queryClient} children={children} />
}
