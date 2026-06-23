import rehypeHighlight from 'rehype-highlight'
import rehypeParse from 'rehype-parse'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

const looksLikeHtml = (content: string) => /<\/?[a-z][\s\S]*>/i.test(content.trim().slice(0, 400))

const markdownPipeline = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSanitize).use(rehypeHighlight).use(rehypeStringify)
const htmlPipeline = unified().use(rehypeParse, { fragment: true }).use(rehypeSanitize).use(rehypeHighlight).use(rehypeStringify)

export const renderContent = async (content: string | null) => {
    if (!content) return ''
    const pipeline = looksLikeHtml(content) ? htmlPipeline : markdownPipeline
    const file = await pipeline.process(content)
    return String(file)
}
