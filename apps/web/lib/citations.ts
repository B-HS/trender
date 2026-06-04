export const linkifyCitations = (markdown: string, articleIdByRank: Map<number, number>) =>
    markdown.replace(/\[#(\d+)\]/g, (whole, n) => {
        const articleId = articleIdByRank.get(Number(n))
        return articleId ? `[#${n}](/articles/${articleId})` : whole
    })
