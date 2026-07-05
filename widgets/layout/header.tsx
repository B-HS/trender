'use client'

import { ThemeChanger } from '@features/theme/theme-changer'
import { cn } from '@lib/utils'
import { buttonVariants } from '@ui/button'
import { AuthNav } from '@widgets/layout/auth-nav'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FC } from 'react'

const NAVS = [
    { href: '/article', label: '기사' },
    { href: '/vendor', label: '기업' },
] as const

interface LayoutHeaderProps {
    className?: string
}

export const LayoutHeader: FC<LayoutHeaderProps> = ({ className }) => {
    const pathname = usePathname()

    return (
        <header
            className={cn(
                'sticky top-0 z-50 h-12 px-3 lg:px-6 flex items-center justify-between backdrop-blur-xs bg-background/60 border-b',
                className,
            )}>
            <div className='flex items-center gap-3'>
                <Link href='/'>
                    <h1 className='font-extrabold text-lg tracking-tighter'>Trender</h1>
                </Link>
                <nav className='flex items-center gap-1'>
                    {NAVS.map((nav) => (
                        <Link
                            key={nav.href}
                            href={nav.href}
                            className={cn(
                                buttonVariants({ variant: 'ghost', size: 'sm' }),
                                pathname.startsWith(nav.href) && 'bg-accent text-accent-foreground',
                            )}>
                            {nav.label}
                        </Link>
                    ))}
                </nav>
            </div>
            <div className='flex items-center gap-1'>
                <AuthNav />
                <ThemeChanger />
            </div>
        </header>
    )
}
