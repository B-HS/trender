'use client'
import { useEffect, useRef, useState } from 'react'
import type { FC } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Markdown } from '@/components/markdown'
import { useTranslationPreference } from '@/lib/use-translation-preference'

type Heading = { id: string; text: string; level: number }

const slugify = (text: string, index: number) =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 60) || `section-${index}`

type ReportBodyProps = {
    originalMarkdown: string
    translatedMarkdown: string | null
    untranslated?: boolean
}

export const ReportBody: FC<ReportBodyProps> = ({ originalMarkdown, translatedMarkdown, untranslated }) => {
    const contentRef = useRef<HTMLDivElement>(null)
    const [showTranslated, setShowTranslated] = useTranslationPreference()
    const [headings, setHeadings] = useState<Heading[]>([])

    const active = Boolean(translatedMarkdown) && showTranslated
    const source = active && translatedMarkdown ? translatedMarkdown : originalMarkdown

    useEffect(() => {
        const root = contentRef.current
        if (!root) return
        const list = Array.from(root.querySelectorAll('h2, h3')).map((el, i) => {
            const text = el.textContent ?? ''
            if (!el.id) el.id = slugify(text, i)
            return { id: el.id, text, level: el.tagName === 'H2' ? 2 : 3 }
        })
        setHeadings(list)
    }, [source])

    const handleJump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    return (
        <div className='flex flex-col gap-3'>
            {translatedMarkdown ? (
                <div className='flex gap-1.5'>
                    <Button size='sm' variant={active ? 'outline' : 'default'} onClick={() => setShowTranslated(false)}>
                        원문
                    </Button>
                    <Button size='sm' variant={active ? 'default' : 'outline'} onClick={() => setShowTranslated(true)}>
                        번역글
                    </Button>
                </div>
            ) : untranslated ? (
                <span className='text-muted-foreground w-fit text-xs italic'>(번역 없음)</span>
            ) : null}

            {headings.length >= 3 ? (
                <details className='bg-card/40 border-border/60 rounded-lg border px-4 py-3 text-sm'>
                    <summary className='text-muted-foreground cursor-pointer font-medium select-none'>목차</summary>
                    <ul className='mt-2 flex flex-col gap-1'>
                        {headings.map((h) => (
                            <li key={h.id} className={h.level === 3 ? 'pl-4' : ''}>
                                <button
                                    onClick={() => handleJump(h.id)}
                                    className='text-muted-foreground hover:text-foreground text-left transition-colors'>
                                    {h.text}
                                </button>
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}

            <div ref={contentRef}>
                <Markdown source={source} />
            </div>
        </div>
    )
}
