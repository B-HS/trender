'use client'
import { useState } from 'react'
import type { FC } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Markdown } from '@/components/markdown'

type ReportBodyProps = {
    originalMarkdown: string
    translatedMarkdown: string | null
    untranslated?: boolean
}

export const ReportBody: FC<ReportBodyProps> = ({ originalMarkdown, translatedMarkdown, untranslated }) => {
    const [showTranslated, setShowTranslated] = useState(false)

    if (!translatedMarkdown)
        return (
            <div className='flex flex-col gap-3'>
                {untranslated ? <span className='text-muted-foreground w-fit text-xs italic'>(번역 없음)</span> : null}
                <Markdown source={originalMarkdown} />
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
            <Markdown source={showTranslated ? translatedMarkdown : originalMarkdown} />
        </div>
    )
}
