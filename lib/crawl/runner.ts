import type { CrawledItem, Provider, RawListItem } from '@entities/source/provider.type'

export type RunOptions = {
    limit?: number
    skipUrl?: (url: string) => boolean
    items?: RawListItem[]
}

export const runProvider = async (provider: Provider, opts: RunOptions = {}) => {
    const list = opts.items ?? (await provider.list())
    const filtered = provider.noiseFilter ? list.filter(provider.noiseFilter) : list
    const seen = new Set<string>()
    const out: CrawledItem[] = []

    for (const item of filtered) {
        if (opts.limit != null && out.length >= opts.limit) break
        const key = provider.dedupKey ? provider.dedupKey(item) : item.url
        if (!key || seen.has(key)) continue
        seen.add(key)
        if (opts.skipUrl?.(item.url)) continue

        let content = item.content ?? null
        if (!content && provider.fetchBody) {
            try {
                content = await provider.fetchBody(item)
            } catch {
                content = item.summary ?? null
            }
        }
        out.push({ ...item, contentOriginal: content })
    }

    return out
}
