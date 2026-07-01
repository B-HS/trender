import { renderContent } from '@lib/render/content'
import { FC } from 'react'

export const ContentView: FC<{ content: string | null }> = async ({ content }) => {
    const html = await renderContent(content)
    if (!html) return <p className='text-muted-foreground'>본문이 없습니다.</p>
    return <div className='prose min-w-0 max-w-none' dangerouslySetInnerHTML={{ __html: html }} />
}
