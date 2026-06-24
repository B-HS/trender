export const linkifyCitations = (markdown: string, rankToId: Map<number, number>) =>
    markdown.replace(/\[#(\d+)\]/g, (match, n) => {
        const articleId = rankToId.get(Number(n))
        return articleId ? `[\\[#${n}\\]](/article/${articleId})` : match
    })
