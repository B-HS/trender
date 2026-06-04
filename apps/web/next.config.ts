import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    transpilePackages: ['@workspace/ui'],
    cacheComponents: true,
    cacheLife: {
        permanent: {
            stale: 300,
            revalidate: 31536000,
            expire: 34128000,
        },
    },
}

export default nextConfig
