'use client'

import { LANG_OPTIONS } from '@lib/constants'
import { Badge } from '@ui/badge'
import { Button } from '@ui/button'
import { Input } from '@ui/input'
import { SearchIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FC, KeyboardEvent, useState } from 'react'

export const ArticleSearch: FC<{ showLang?: boolean }> = ({ showLang = true }) => {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [keyword, setKeyword] = useState(searchParams.get('q') ?? '')
    const lang = searchParams.get('lang') ?? 'ko'

    const apply = (next: { q?: string; lang?: string }) => {
        const params = new URLSearchParams(searchParams.toString())
        const q = next.q ?? keyword
        q.trim() ? params.set('q', q.trim()) : params.delete('q')
        if (next.lang) params.set('lang', next.lang)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') apply({})
    }

    return (
        <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3.5'>
            {showLang ? (
                <nav className='flex gap-2 overflow-x-auto min-w-fit' aria-label='언어 필터'>
                    {LANG_OPTIONS.map((opt) => (
                        <Badge
                            key={opt.value}
                            className='rounded cursor-pointer shrink-0'
                            variant={lang === opt.value ? 'default' : 'secondary'}
                            onClick={() => apply({ lang: opt.value })}>
                            {opt.label}
                        </Badge>
                    ))}
                </nav>
            ) : (
                <span />
            )}
            <form
                className='flex gap-2 w-full sm:w-auto sm:justify-end'
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
        </div>
    )
}
