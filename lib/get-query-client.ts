import { isServer, QueryClient } from '@tanstack/react-query'

const makeQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60_000,
                gcTime: 5 * 60_000,
                refetchOnWindowFocus: false,
            },
        },
    })

let browserQueryClient: QueryClient | undefined

export const getQueryClient = () => {
    if (isServer) return makeQueryClient()
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
}
