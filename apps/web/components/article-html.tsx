import 'server-only'
import type { FC } from 'react'
import { sanitizeArticleHtml } from '@/lib/sanitize'
import { PROSE_CLASSNAME } from '@/lib/prose'

type ArticleHtmlProps = {
    html: string
}

export const ArticleHtml: FC<ArticleHtmlProps> = ({ html }) => (
    <article className={PROSE_CLASSNAME} dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(html) }} />
)
