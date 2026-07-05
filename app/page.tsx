export const revalidate = 1800

import { listArticles } from '@entities/article/article.repo'
import { ArticleCard } from '@features/article/article-card'
import { RevalidateButton } from '@features/common/revalidate-button'
import { CARD_GRID, LANG_OPTIONS } from '@lib/constants'
import Link from 'next/link'

const Section = ({ title, href, children }: { title: string; href: string; children: React.ReactNode }) => (
    <section className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
            <h2 className='text-xl font-bold'>{title}</h2>
            <Link href={href} className='text-sm text-muted-foreground hover:underline'>
                더보기
            </Link>
        </div>
        {children}
    </section>
)

const Home = async () => {
    const sections = await Promise.all(
        LANG_OPTIONS.map(async (option) => ({
            ...option,
            articles: await listArticles({ vendor: 'none', lang: option.value, limit: 3 }),
        })),
    )

    return (
        <div className='flex flex-col gap-8 py-2'>
            <div className='flex justify-end'>
                <RevalidateButton path='/' />
            </div>
            {sections.map((section) => (
                <Section key={section.value} title={`${section.label} 기사`} href={`/article?lang=${section.value}`}>
                    {section.articles.length > 0 ? (
                        <div className={CARD_GRID}>
                            {section.articles.map((article) => (
                                <ArticleCard key={article.id} article={article} />
                            ))}
                        </div>
                    ) : (
                        <p className='text-muted-foreground text-sm'>아직 수집된 기사가 없습니다.</p>
                    )}
                </Section>
            ))}
        </div>
    )
}

export default Home
