'use client'
import { useState } from 'react'
import type { FC } from 'react'
import { Button } from '@workspace/ui/components/button'
import { PROSE_CLASSNAME } from '@/lib/prose'

type ArticleBodyProps = {
    originalHtml: string
    translatedHtml: string | null
    untranslated?: boolean
}

export const ArticleBody: FC<ArticleBodyProps> = ({ originalHtml, translatedHtml, untranslated }) => {
    const [showTranslated, setShowTranslated] = useState(false)

    if (!translatedHtml)
        return (
            <div className='flex flex-col gap-3'>
                {untranslated ? <span className='text-muted-foreground w-fit text-xs italic'>(번역 없음)</span> : null}
                <div className={PROSE_CLASSNAME} dangerouslySetInnerHTML={{ __html: originalHtml }} />
            </div>
        )

    return (
        <div className='flex flex-col gap-3'>
            <div className='flex gap-1.5'>
                <Button size='sm' variant={showTranslated ? 'outline' : 'default'} onClick={() => setShowTranslated(false)}>
                    원문
                </Button>
                <Button size='sm' variant={showTranslated ? 'default' : 'outline'} onClick={() => setShowTranslated(true)}>
                    번역글
                </Button>
            </div>
            <div className={PROSE_CLASSNAME} dangerouslySetInnerHTML={{ __html: showTranslated ? translatedHtml : originalHtml }} />
        </div>
    )
}
