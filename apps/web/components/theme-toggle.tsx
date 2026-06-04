'use client'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from '@phosphor-icons/react'

export const ThemeToggle = () => {
    const [mounted, setMounted] = useState(false)
    const { resolvedTheme, setTheme } = useTheme()

    useEffect(() => setMounted(true), [])

    if (!mounted) return <span className='size-8' aria-hidden='true' />

    const isDark = resolvedTheme === 'dark'

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            className='text-muted-foreground hover:text-foreground hover:bg-accent rounded-md p-1.5 transition-colors'>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    )
}
