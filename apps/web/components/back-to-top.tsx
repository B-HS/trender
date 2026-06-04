'use client'
import { useEffect, useState } from 'react'
import { ArrowUp } from '@phosphor-icons/react'

export const BackToTop = () => {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 600)
        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll()
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    if (!visible) return null

    return (
        <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label='맨 위로'
            className='bg-background/80 text-muted-foreground hover:text-foreground hover:bg-accent fixed right-5 bottom-5 z-50 rounded-full border p-2.5 shadow-sm backdrop-blur transition-colors'>
            <ArrowUp size={18} weight='bold' />
        </button>
    )
}
