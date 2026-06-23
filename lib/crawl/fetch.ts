import iconv from 'iconv-lite'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export const fetchText = async (url: string, headers?: Record<string, string>) => {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*', ...headers }, redirect: 'follow' })
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const ctype = res.headers.get('content-type') ?? ''
    let charset = /charset=["']?([\w-]+)/i.exec(ctype)?.[1]
    if (!charset) {
        const head = buf.subarray(0, 2048).toString('latin1')
        charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]
    }
    if (charset && !/utf-?8/i.test(charset) && iconv.encodingExists(charset)) return iconv.decode(buf, charset)
    return buf.toString('utf8')
}

export const fetchJson = async <T>(url: string, headers?: Record<string, string>) => JSON.parse(await fetchText(url, headers)) as T
