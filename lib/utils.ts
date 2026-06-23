import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const getHostname = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return url
    }
}

const HOST_LABEL: Record<string, string> = {
    'rss.itmedia.co.jp': 'ITmedia',
    'itmedia.co.jp': 'ITmedia',
    'news.hada.io': 'GeekNews',
    'aitimes.com': 'AI타임스',
    'yozm.wishket.com': '요즘IT',
    'd2.naver.com': 'Naver D2',
    'tech.kakao.com': 'KakaoTech',
    'openai.com': 'OpenAI',
    'raw.githubusercontent.com': 'Anthropic',
    'huggingface.co': 'HuggingFace',
    'deepmind.google': 'DeepMind',
    'research.google': 'Google Research',
    'simonwillison.net': 'Simon Willison',
    'magazine.sebastianraschka.com': 'Ahead of AI',
    'marktechpost.com': 'MarkTechPost',
    'publickey1.jp': 'Publickey',
    'b.hatena.ne.jp': 'はてブ',
}

export const sourceLabel = (value: string) => {
    if (value.startsWith('qiita:') || value.includes('qiita.com')) return 'Qiita'
    if (value.startsWith('zenn:') || value.includes('zenn.dev')) return 'Zenn'
    const host = getHostname(value)
    return HOST_LABEL[host] ?? host
}

export const sourceBadges = (value: string) => {
    if (value.startsWith('qiita:') || value.includes('qiita.com')) {
        const tag = value.startsWith('qiita:') ? value.split(':').pop() : undefined
        return tag ? ['Qiita', tag.toUpperCase()] : ['Qiita']
    }
    if (value.startsWith('zenn:') || value.includes('zenn.dev')) {
        const topic = value.startsWith('zenn:') ? value.split(':').pop() : undefined
        return topic ? ['Zenn', topic.toUpperCase()] : ['Zenn']
    }
    const host = getHostname(value)
    return [HOST_LABEL[host] ?? host]
}

const NAMED_ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export const decodeEntities = (text: string) =>
    text
        .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m, name) => NAMED_ENTITY[name] ?? m)
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
