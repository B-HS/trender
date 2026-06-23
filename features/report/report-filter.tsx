'use client'

import { LANG_OPTIONS, REPORT_KIND_OPTIONS } from '@lib/constants'
import { Badge } from '@ui/badge'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FC } from 'react'

export const ReportFilter: FC<{ showKind?: boolean; showLang?: boolean }> = ({ showKind = true, showLang = true }) => {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const kind = searchParams.get('kind') ?? ''
    const lang = searchParams.get('lang') ?? 'ko'

    const setParam = (key: 'kind' | 'lang', value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        value ? params.set(key, value) : params.delete(key)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5'>
            {showKind && (
                <div className='flex items-center gap-2'>
                    <span className='text-xs text-muted-foreground shrink-0'>기간</span>
                    <nav className='flex gap-2 overflow-x-auto'>
                        {REPORT_KIND_OPTIONS.map((opt) => (
                            <Badge
                                key={opt.value}
                                className='rounded cursor-pointer shrink-0'
                                variant={kind === opt.value ? 'default' : 'secondary'}
                                onClick={() => setParam('kind', kind === opt.value ? '' : opt.value)}>
                                {opt.label}
                            </Badge>
                        ))}
                    </nav>
                </div>
            )}
            {showLang && (
                <div className='flex items-center gap-2'>
                    <span className='text-xs text-muted-foreground shrink-0'>언어</span>
                    <nav className='flex gap-2 overflow-x-auto'>
                        {LANG_OPTIONS.map((opt) => (
                            <Badge
                                key={opt.value}
                                className='rounded cursor-pointer shrink-0'
                                variant={lang === opt.value ? 'default' : 'secondary'}
                                onClick={() => setParam('lang', opt.value)}>
                                {opt.label}
                            </Badge>
                        ))}
                    </nav>
                </div>
            )}
        </div>
    )
}
