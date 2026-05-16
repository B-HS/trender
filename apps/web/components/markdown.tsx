import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkCjkFriendly from 'remark-cjk-friendly'
import rehypeSanitize from 'rehype-sanitize'

export const Markdown = ({ source }: { source: string }) => {
    return (
        <article className='prose prose-neutral prose-sm sm:prose-base dark:prose-invert max-w-none wrap-break-word prose-headings:scroll-mt-20 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:break-all prose-pre:overflow-x-auto'>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkCjkFriendly]} rehypePlugins={[rehypeSanitize]}>
                {source}
            </ReactMarkdown>
        </article>
    )
}
