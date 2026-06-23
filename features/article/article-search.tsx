'use client'

import { LANG_OPTIONS, PERIOD_OPTIONS } from '@lib/constants'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Input } from '@ui/input'
import { SearchIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FC, KeyboardEvent, useState } from 'react'

type SourceOption = { value: string; label: string }

export const ArticleSearch: FC<{ showLang?: boolean; sources?: SourceOption[] }> = ({ showLang = true, sources }) => {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [keyword, setKeyword] = useState(searchParams.get('q') ?? '')
    const lang = searchParams.get('lang') ?? 'ko'
    const source = searchParams.get('source') ?? ''
    const period = searchParams.get('period') ?? ''

    const apply = (next: { q?: string; lang?: string; source?: string; period?: string }) => {
        const params = new URLSearchParams(searchParams.toString())
        const q = next.q ?? keyword
        q.trim() ? params.set('q', q.trim()) : params.delete('q')
        if (next.lang) {
            params.set('lang', next.lang)
            params.delete('source')
        }
        if (next.source !== undefined) next.source ? params.set('source', next.source) : params.delete('source')
        if (next.period !== undefined) next.period ? params.set('period', next.period) : params.delete('period')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') apply({})
    }

    const badge = (active: boolean, label: string, onClick: () => void) => (
        <Badge key={label} className='rounded cursor-pointer shrink-0' variant={active ? 'default' : 'secondary'} onClick={onClick}>
            {label}
        </Badge>
    )

    const filterRow = (label: string, children: React.ReactNode) => (
        <div className='flex items-center gap-2'>
            <span className='w-9 shrink-0 text-xs text-muted-foreground'>{label}</span>
            <nav className='flex gap-2 overflow-x-auto'>{children}</nav>
        </div>
    )

    return (
        <div className='flex flex-col gap-2'>
            <form
                className='flex gap-2 w-full sm:w-auto sm:ml-auto'
                role='search'
                onSubmit={(e) => {
                    e.preventDefault()
                    apply({})
                }}>
                <div className='relative flex-1 sm:flex-initial sm:w-56'>
                    <Input
                        className='pl-8 focus-visible:ring-0 focus-visible:outline-none'
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder='제목 검색'
                        aria-label='기사 검색'
                    />
                    <SearchIcon className='size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground' />
                </div>
                <Button variant='outline' type='submit' className='shrink-0'>
                    검색
                </Button>
            </form>
            {showLang &&
                filterRow(
                    '언어',
                    LANG_OPTIONS.map((opt) => badge(lang === opt.value, opt.label, () => apply({ lang: opt.value }))),
                )}
            {filterRow(
                '기간',
                PERIOD_OPTIONS.map((opt) => badge(period === opt.value, opt.label, () => apply({ period: period === opt.value ? '' : opt.value }))),
            )}
            {showLang &&
                sources &&
                sources.length > 0 &&
                filterRow(
                    '소스',
                    sources.map((s) => badge(source === s.value, s.label, () => apply({ source: source === s.value ? '' : s.value }))),
                )}
        </div>
    )
}
