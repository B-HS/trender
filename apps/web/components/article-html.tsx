import 'server-only'
import sanitizeHtml from 'sanitize-html'
import type { FC } from 'react'

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'ul', 'ol', 'li',
        'a', 'img', 'figure', 'figcaption',
        'strong', 'em', 'b', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup',
        'blockquote', 'pre', 'code',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
        'span', 'div', 'section', 'article',
    ],
    allowedAttributes: {
        a: ['href', 'title', 'rel', 'target'],
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
        code: ['class'],
        pre: ['class'],
        span: ['class'],
        div: ['class'],
        th: ['colspan', 'rowspan', 'scope'],
        td: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'data', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    transformTags: {
        a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noreferrer noopener' }),
        img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
    },
    disallowedTagsMode: 'discard',
}

type ArticleHtmlProps = {
    html: string
}

export const ArticleHtml: FC<ArticleHtmlProps> = ({ html }) => {
    const clean = sanitizeHtml(html, SANITIZE_OPTIONS)
    return (
        <article
            className='prose prose-neutral prose-sm sm:prose-base dark:prose-invert max-w-none wrap-break-word prose-headings:scroll-mt-20 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:break-all prose-pre:overflow-x-auto prose-img:rounded-md'
            dangerouslySetInnerHTML={{ __html: clean }}
        />
    )
}
