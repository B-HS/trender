'use client'

import { cn } from '@lib/utils'
import { Button } from '@ui/button'
import { FC, useState } from 'react'

type ContentToggleProps = {
    originalTitle: string
    translatedTitle: string | null
    originalHtml: string
    translatedHtml: string
    actions: React.ReactNode
}

export const ContentToggle: FC<ContentToggleProps> = ({ originalTitle, translatedTitle, originalHtml, translatedHtml, actions }) => {
    const [showTranslated, setShowTranslated] = useState(false)
    const hasTranslation = translatedHtml.length > 0 || !!translatedTitle

    const title = showTranslated && translatedTitle ? translatedTitle : originalTitle
    const html = showTranslated && translatedHtml ? translatedHtml : originalHtml

    return (
        <>
            <div className='flex items-start justify-between gap-2'>
                <h1 className='text-2xl font-extrabold tracking-tight'>{title}</h1>
                {actions}
            </div>
            {hasTranslation && (
                <div className='flex w-fit rounded-md border p-0.5 text-sm'>
                    <Button variant={showTranslated ? 'ghost' : 'secondary'} size='sm' className='h-7' onClick={() => setShowTranslated(false)}>
                        원문
                    </Button>
                    <Button variant={showTranslated ? 'secondary' : 'ghost'} size='sm' className='h-7' onClick={() => setShowTranslated(true)}>
                        한국어
                    </Button>
                </div>
            )}
            {html ? (
                <div className={cn('prose max-w-none')} dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
                <p className='text-muted-foreground'>본문이 없습니다.</p>
            )}
        </>
    )
}
