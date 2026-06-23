'use client'

import { cn } from '@lib/utils'
import { VENDOR_LABEL, VENDOR_ORDER } from '@lib/constants'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const REPORT_LINKS = [
    { href: '/vendor/report/daily', label: '일일 리포트' },
    { href: '/vendor/report/weekly', label: '주간 리포트' },
]

export const VendorSidebar = () => {
    const pathname = usePathname()

    const item = (href: string, label: string) => (
        <Link
            key={href}
            href={href}
            className={cn(
                'shrink-0 rounded px-3 py-2 text-sm font-medium hover:bg-accent transition-colors whitespace-nowrap',
                pathname === href && 'bg-accent text-accent-foreground',
            )}>
            {label}
        </Link>
    )

    return (
        <nav className='flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible border-b lg:border-b-0 lg:border-r pb-2 lg:pb-0 lg:pr-4 lg:w-44 lg:shrink-0'>
            {REPORT_LINKS.map((l) => item(l.href, l.label))}
            <div className='hidden lg:block h-px bg-border my-1' />
            {VENDOR_ORDER.map((v) => item(`/vendor/${v}`, VENDOR_LABEL[v]))}
        </nav>
    )
}
