import { Suspense } from 'react'
import Link from 'next/link'
import { favorites, articles, reports, eq, desc, inArray } from '@workspace/db'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Separator } from '@workspace/ui/components/separator'
import { FavoriteButton } from '@/components/favorite-button'

const LANG_LABEL: Record<string, string> = { ko: '한국어', ja: '日本語', en: 'English' }
const KIND_LABEL: Record<string, Record<string, string>> = {
    daily: { ko: '일간', ja: '日次', en: 'Daily' },
    weekly: { ko: '주간', ja: '週次', en: 'Weekly' },
}

const FavoritesContent = async () => {
    const user = await getSessionUser()

    if (!user)
        return (
            <div className='flex flex-col gap-3'>
                <h1 className='text-2xl font-semibold sm:text-3xl'>책갈피</h1>
                <p className='text-muted-foreground text-sm'>로그인하면 저장한 기사·리포트를 모아볼 수 있습니다. 우측 상단에서 로그인하세요.</p>
            </div>
        )

    const favs = await db
        .select({ targetType: favorites.targetType, targetId: favorites.targetId })
        .from(favorites)
        .where(eq(favorites.userId, user.id))
        .orderBy(desc(favorites.createdAt))

    const reportIds = favs.filter((f) => f.targetType === 'report').map((f) => f.targetId)
    const articleIds = favs.filter((f) => f.targetType === 'article').map((f) => f.targetId)

    const reportRows = reportIds.length
        ? await db.select({ id: reports.id, title: reports.title, kind: reports.kind, lang: reports.lang }).from(reports).where(inArray(reports.id, reportIds))
        : []
    const articleRows = articleIds.length
        ? await db.select({ id: articles.id, titleOriginal: articles.titleOriginal, lang: articles.lang }).from(articles).where(inArray(articles.id, articleIds))
        : []

    const reportById = new Map(reportRows.map((r) => [r.id, r]))
    const articleById = new Map(articleRows.map((a) => [a.id, a]))
    const orderedReports = reportIds.map((id) => reportById.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r))
    const orderedArticles = articleIds.map((id) => articleById.get(id)).filter((a): a is NonNullable<typeof a> => Boolean(a))

    return (
        <div className='flex flex-col gap-8 sm:gap-10'>
            <h1 className='text-2xl font-semibold sm:text-3xl'>책갈피</h1>

            {favs.length === 0 ? <p className='text-muted-foreground text-sm'>아직 저장한 항목이 없습니다. 기사·리포트에서 책갈피를 눌러 보세요.</p> : null}

            {orderedReports.length > 0 ? (
                <section className='flex flex-col gap-3'>
                    <div className='flex items-baseline gap-2'>
                        <h2 className='text-xl font-semibold'>리포트</h2>
                        <span className='text-muted-foreground text-sm'>{orderedReports.length}건</span>
                    </div>
                    <div className='flex flex-col gap-3'>
                        {orderedReports.map((r) => (
                            <Card key={r.id} className='transition-colors hover:bg-accent'>
                                <CardHeader className='gap-2'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <Badge variant='secondary'>{KIND_LABEL[r.kind]?.[r.lang] ?? r.kind}</Badge>
                                        <Badge variant='outline'>{LANG_LABEL[r.lang] ?? r.lang}</Badge>
                                        <FavoriteButton targetType='report' targetId={r.id} className='ml-auto' />
                                    </div>
                                    <CardTitle className='text-base leading-snug sm:text-lg'>
                                        <Link href={`/reports/${r.id}`} className='wrap-break-word hover:underline'>
                                            {r.title}
                                        </Link>
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </section>
            ) : null}

            {orderedReports.length > 0 && orderedArticles.length > 0 ? <Separator /> : null}

            {orderedArticles.length > 0 ? (
                <section className='flex flex-col gap-3'>
                    <div className='flex items-baseline gap-2'>
                        <h2 className='text-xl font-semibold'>기사</h2>
                        <span className='text-muted-foreground text-sm'>{orderedArticles.length}건</span>
                    </div>
                    <div className='flex flex-col gap-3'>
                        {orderedArticles.map((a) => (
                            <Card key={a.id} className='transition-colors hover:bg-accent'>
                                <CardContent className='flex items-start justify-between gap-3'>
                                    <Link href={`/articles/${a.id}`} className='wrap-break-word text-sm leading-snug hover:underline'>
                                        <Badge variant='secondary' className='mr-2 align-middle font-normal'>
                                            {LANG_LABEL[a.lang] ?? a.lang}
                                        </Badge>
                                        {a.titleOriginal}
                                    </Link>
                                    <FavoriteButton targetType='article' targetId={a.id} className='shrink-0' />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    )
}

const Page = () => (
    <Suspense fallback={<p className='text-muted-foreground text-sm'>불러오는 중…</p>}>
        <FavoritesContent />
    </Suspense>
)

export default Page
