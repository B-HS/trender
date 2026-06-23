export const QUERY_KEY = {
    AUTH: { ME: ['auth', 'me'] },
    ARTICLE: {
        LIST: (vendor: string, q: string, lang: string, source: string, period: string) => ['article', 'list', vendor, q, lang, source, period],
    },
    FAVORITE: { IDS: (targetType: string) => ['favorite', 'ids', targetType] },
}

export const VENDOR_LABEL = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    meta: 'Meta',
    naver: 'Naver',
    kakao: 'Kakao',
} as const

export const VENDOR_ORDER = ['openai', 'anthropic', 'google', 'naver', 'kakao'] as const

export const LANG_OPTIONS = [
    { value: 'ko', label: '한국어' },
    { value: 'ja', label: '日本語' },
    { value: 'en', label: 'English' },
] as const

export const REPORT_KIND_OPTIONS = [
    { value: 'daily', label: '일일' },
    { value: 'weekly', label: '주간' },
] as const

export const PERIOD_OPTIONS = [
    { value: 'today', label: '오늘' },
    { value: '3d', label: '3일' },
    { value: '7d', label: '7일' },
] as const

export const CARD_GRID = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'
