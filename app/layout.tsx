import { VirtualScroll } from '@features/theme/virtual-scroll'
import { TanstackQueryProvider } from '@lib/providers/tanstack-query-provider'
import { ThemeProvider } from '@lib/providers/theme-provider'
import { Toaster } from '@ui/sonner'
import { GoToTop } from '@widgets/layout/go-to-top'
import { LayoutHeader } from '@widgets/layout/header'
import { Analytics } from '@vercel/analytics/next'
import { Metadata } from 'next'
import { FC, PropsWithChildren } from 'react'
import './globals.css'

export const metadata: Metadata = {
    title: {
        default: 'Trender',
        template: '%s | Trender',
    },
    description: 'AI 트렌드 — 기사 · 리포트 · 기업 소식',
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false, noimageindex: true },
    },
}

const Layout: FC<PropsWithChildren> = ({ children }) => {
    return (
        <html lang='ko' data-scroll-behavior='smooth' suppressHydrationWarning>
            <body className='antialiased relative'>
                <ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
                    <TanstackQueryProvider>
                        <LayoutHeader />
                        <main className='mx-auto w-full max-w-5xl px-4 lg:px-6 py-6'>{children}</main>
                    </TanstackQueryProvider>
                </ThemeProvider>
                <VirtualScroll />
                <Toaster />
                <GoToTop />
                <Analytics />
            </body>
        </html>
    )
}

export default Layout
