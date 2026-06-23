import type { Provider } from './provider.type'
import {
    createAggregatorProvider,
    createArticleProvider,
    createFeedFullProvider,
    createMdProvider,
    createThinFeedProvider,
} from '@lib/crawl/factories'
import { createZennProvider } from './providers/zenn'
import { createQiitaProvider } from './providers/qiita'

export const PROVIDERS: Provider[] = [
    createZennProvider('ai'),
    createZennProvider('llm'),
    createQiitaProvider('ai'),
    createQiitaProvider('llm'),

    createMdProvider({
        id: 'geeknews',
        name: 'GeekNews',
        lang: 'ko',
        feedUrl: 'https://news.hada.io/rss/news',
        mdBase: 'https://news.hada.io/topic',
    }),
    createArticleProvider({
        id: 'aitimes',
        name: 'AI타임스',
        lang: 'ko',
        feedUrl: 'https://www.aitimes.com/rss/allArticle.xml',
        selectors: ['#article-view-content-div'],
    }),
    createFeedFullProvider({ id: 'yozm', name: '요즘IT', lang: 'ko', feedUrl: 'https://yozm.wishket.com/magazine/feed/' }),
    createFeedFullProvider({ id: 'naver-d2', name: 'Naver D2', lang: 'ko', feedUrl: 'https://d2.naver.com/d2.atom', vendor: 'naver' }),
    createThinFeedProvider({ id: 'kakaotech', name: 'KakaoTech', lang: 'ko', feedUrl: 'https://tech.kakao.com/feed', vendor: 'kakao' }),

    createArticleProvider({
        id: 'itmedia',
        name: 'ITmedia AI+',
        lang: 'ja',
        feedUrl: 'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml',
        selectors: ['.l-block__main', '#ArticleText'],
    }),
    createArticleProvider({
        id: 'publickey',
        name: 'Publickey',
        lang: 'ja',
        feedUrl: 'https://www.publickey1.jp/atom.xml',
        selectors: ['div.entrybody', '#maincol'],
    }),
    createAggregatorProvider({
        id: 'hatena-it',
        name: 'はてブ 人気 IT',
        lang: 'ja',
        feedUrl: 'https://b.hatena.ne.jp/hotentry/it.rss',
        selectors: ['article', 'main', '#main', '.entry-content'],
    }),

    createArticleProvider({
        id: 'openai',
        name: 'OpenAI News',
        lang: 'en',
        feedUrl: 'https://openai.com/news/rss.xml',
        vendor: 'openai',
        selectors: ['article', 'main'],
    }),
    createFeedFullProvider({
        id: 'anthropic',
        name: 'Anthropic',
        lang: 'en',
        feedUrl: 'https://raw.githubusercontent.com/tim-hilde/anthropic-rss/main/docs/rss.xml',
        vendor: 'anthropic',
    }),
    createArticleProvider({
        id: 'huggingface',
        name: 'HuggingFace',
        lang: 'en',
        feedUrl: 'https://huggingface.co/blog/feed.xml',
        selectors: ['div.blog-content'],
    }),
    createArticleProvider({
        id: 'deepmind',
        name: 'DeepMind',
        lang: 'en',
        feedUrl: 'https://deepmind.google/blog/rss.xml',
        vendor: 'google',
        selectors: ['div.rich-text'],
    }),
    createArticleProvider({
        id: 'google-research',
        name: 'Google Research',
        lang: 'en',
        feedUrl: 'https://research.google/blog/rss/',
        vendor: 'google',
        selectors: ['div.rich-text'],
    }),
    createFeedFullProvider({ id: 'simon-willison', name: 'Simon Willison', lang: 'en', feedUrl: 'https://simonwillison.net/atom/everything/' }),
    createFeedFullProvider({ id: 'raschka', name: 'Ahead of AI', lang: 'en', feedUrl: 'https://magazine.sebastianraschka.com/feed' }),
    createFeedFullProvider({ id: 'marktechpost', name: 'MarkTechPost', lang: 'en', feedUrl: 'https://www.marktechpost.com/feed/' }),
]

export const getProvider = (id: string) => PROVIDERS.find((p) => p.id === id)
