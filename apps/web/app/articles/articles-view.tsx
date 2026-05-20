'use client'

import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader } from '@workspace/ui/components/card'
import { ArticleCard } from './article-card'
import { loadArticles, loadTopKeywords } from './actions'
import type { ArticleCursor, ArticleRow, KeywordMode, Lang, LoadArticlesResult, SourceOption } from './actions'

type ArticlesViewProps = {
    initialQuery: { lang: Lang | null; sourceId: number | null; q: string | null; keywordMode: KeywordMode }
    sourceOptions: SourceOption[]
    topKeywords: string[]
    totalCount: number
}

const LANG_OPTIONS: { value: Lang | null; label: string }[] = [
    { value: null, label: '전체' },
    { value: 'ko', label: '한국어' },
    { value: 'ja', label: '일본어' },
    { value: 'en', label: '영어' },
]

const ArticleSkeleton: FC = () => (
    <Card className='overflow-hidden'>
        <CardHeader className='gap-2 pb-2'>
            <div className='flex gap-2'>
                <div className='bg-muted h-5 w-14 animate-pulse rounded' />
                <div className='bg-muted h-4 w-20 animate-pulse rounded' />
            </div>
            <div className='bg-muted h-5 w-3/4 animate-pulse rounded' />
        </CardHeader>
        <CardContent className='space-y-2'>
            <div className='bg-muted h-4 w-full animate-pulse rounded' />
            <div className='bg-muted h-4 w-11/12 animate-pulse rounded' />
            <div className='bg-muted h-4 w-4/6 animate-pulse rounded' />
        </CardContent>
    </Card>
)

export const ArticlesView: FC<ArticlesViewProps> = ({ initialQuery, sourceOptions, topKeywords, totalCount }) => {
    const router = useRouter()
    const pathname = usePathname()

    const [lang, setLang] = useState<Lang | null>(initialQuery.lang)
    const [sourceId, setSourceId] = useState<number | null>(initialQuery.sourceId)
    const [searchInput, setSearchInput] = useState<string>(initialQuery.q ?? '')
    const [debouncedQ, setDebouncedQ] = useState<string | null>(initialQuery.q)
    const [keywordMode, setKeywordMode] = useState<KeywordMode>(initialQuery.keywordMode)
    const isFirstRender = useRef(true)

    useEffect(() => {
        const trimmed = searchInput.trim()
        const t = setTimeout(() => {
            setDebouncedQ(trimmed.length > 0 ? trimmed : null)
            setKeywordMode((prev) => (prev === 'exact' ? 'like' : prev))
        }, 300)
        return () => clearTimeout(t)
    }, [searchInput])

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        const sp = new URLSearchParams()
        if (lang) sp.set('lang', lang)
        if (sourceId) sp.set('source', String(sourceId))
        if (debouncedQ) sp.set('q', debouncedQ)
        if (debouncedQ && keywordMode === 'exact') sp.set('mode', 'exact')
        const qs = sp.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, [lang, sourceId, debouncedQ, keywordMode, pathname, router])

    const pickKeyword = (kw: string) => {
        setSearchInput(kw)
        setDebouncedQ(kw)
        setKeywordMode('exact')
    }

    const queryKey = useMemo(
        () => ['articles', { lang, sourceId, q: debouncedQ, keywordMode }] as const,
        [lang, sourceId, debouncedQ, keywordMode],
    )

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, isError, error, refetch, isRefetching } = useInfiniteQuery<
        LoadArticlesResult,
        Error,
        { pages: LoadArticlesResult[]; pageParams: (ArticleCursor | null)[] },
        readonly [string, { lang: Lang | null; sourceId: number | null; q: string | null; keywordMode: KeywordMode }],
        ArticleCursor | null
    >({
        queryKey,
        queryFn: ({ pageParam }) => loadArticles({ cursor: pageParam, lang, sourceId, q: debouncedQ, keywordMode }),
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    })

    const { data: liveKeywords } = useQuery({
        queryKey: ['top-keywords', { lang }] as const,
        queryFn: () => loadTopKeywords(lang),
        initialData: topKeywords,
        staleTime: 5 * 60 * 1000,
    })
    const keywords = liveKeywords ?? topKeywords

    const sentinelRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        const el = sentinelRef.current
        if (!el || !hasNextPage || isFetchingNextPage || isError) return
        const io = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) fetchNextPage()
            },
            { rootMargin: '600px 0px' },
        )
        io.observe(el)
        return () => io.disconnect()
    }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage])

    const items: ArticleRow[] = useMemo(() => {
        const seen = new Set<number>()
        const out: ArticleRow[] = []
        for (const page of data?.pages ?? []) {
            for (const r of page.items) {
                if (seen.has(r.id)) continue
                seen.add(r.id)
                out.push(r)
            }
        }
        return out
    }, [data])

    const isFiltered = lang !== null || sourceId !== null || (debouncedQ ?? '').length > 0
    const handleReset = () => {
        setLang(null)
        setSourceId(null)
        setSearchInput('')
        setDebouncedQ(null)
        setKeywordMode('like')
    }

    return (
        <div className='flex flex-col gap-6'>
            <section className='border-border/60 bg-card/40 flex flex-col gap-3 rounded-lg border p-4'>
                <div className='flex flex-wrap items-center gap-2'>
                    {LANG_OPTIONS.map((opt) => {
                        const active = lang === opt.value
                        return (
                            <Button
                                key={opt.label}
                                size='xs'
                                variant={active ? 'secondary' : 'ghost'}
                                onClick={() => setLang(opt.value)}
                                aria-pressed={active}>
                                {opt.label}
                            </Button>
                        )
                    })}
                    <span className='bg-border mx-1 h-4 w-px' aria-hidden='true' />
                    <select
                        value={sourceId ?? ''}
                        onChange={(e) => setSourceId(e.target.value ? Number(e.target.value) : null)}
                        className='border-border bg-background hover:bg-muted focus:ring-ring/40 h-6 max-w-[200px] cursor-pointer truncate rounded-none border px-2 text-xs outline-none focus:ring-1'>
                        <option value=''>전체 소스</option>
                        {sourceOptions.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className='flex items-center gap-2'>
                    <input
                        type='search'
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder='제목·키워드 검색…'
                        className='border-border bg-background placeholder:text-muted-foreground/60 focus:ring-ring/40 h-8 w-full rounded-none border px-3 text-sm outline-none focus:ring-1'
                    />
                    {isFiltered ? (
                        <Button size='sm' variant='ghost' onClick={handleReset} className='shrink-0'>
                            초기화
                        </Button>
                    ) : null}
                    <Button
                        size='sm'
                        variant='outline'
                        onClick={() => refetch()}
                        disabled={isRefetching}
                        className='shrink-0'>
                        새로고침
                    </Button>
                </div>
                {keywords.length > 0 ? (
                    <div className='flex flex-wrap items-center gap-1.5'>
                        <span className='text-muted-foreground/70 mr-1 text-xs'>인기</span>
                        {keywords.map((kw) => {
                            const active = keywordMode === 'exact' && debouncedQ === kw
                            return (
                                <Badge
                                    key={kw}
                                    variant={active ? 'secondary' : 'outline'}
                                    onClick={() => pickKeyword(kw)}
                                    className='hover:bg-muted cursor-pointer font-normal'>
                                    {kw}
                                </Badge>
                            )
                        })}
                    </div>
                ) : null}
                {debouncedQ && keywordMode === 'exact' ? (
                    <p className='text-muted-foreground text-xs'>
                        키워드 <span className='text-foreground font-medium'>“{debouncedQ}”</span> 정확히 일치하는 기사만 표시
                    </p>
                ) : null}
                <p className='text-muted-foreground text-xs'>
                    총 <span className='tabular-nums'>{totalCount.toLocaleString('ko-KR')}</span>건 중{' '}
                    <span className='text-foreground tabular-nums'>{items.length.toLocaleString('ko-KR')}</span>건 표시
                </p>
            </section>

            <div className='flex flex-col gap-3'>
                {isPending ? (
                    <>
                        <ArticleSkeleton />
                        <ArticleSkeleton />
                        <ArticleSkeleton />
                    </>
                ) : items.length === 0 ? (
                    <div className='border-border/60 bg-muted/20 text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center text-sm'>
                        <p className='text-foreground/80 font-medium'>
                            {isFiltered ? '조건에 맞는 기사가 없습니다' : '아직 수집된 기사가 없습니다'}
                        </p>
                        <p className='text-xs'>
                            {isFiltered ? '필터를 조정하거나 초기화해 보세요.' : 'parser가 다음 정시에 수집을 시작하면 여기에 표시됩니다.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {items.map((a) => (
                            <ArticleCard key={a.id} article={a} />
                        ))}

                        {isFetchingNextPage ? (
                            <>
                                <ArticleSkeleton />
                                <ArticleSkeleton />
                            </>
                        ) : null}

                        {isError ? (
                            <div className='border-destructive/30 bg-destructive/5 text-destructive flex flex-col items-center gap-2 rounded-lg border p-4 text-sm'>
                                <span>{error?.message ?? '기사를 불러오지 못했습니다'}</span>
                                <Button size='sm' variant='outline' onClick={() => fetchNextPage()}>
                                    다시 시도
                                </Button>
                            </div>
                        ) : null}

                        {hasNextPage && !isError && !isFetchingNextPage ? (
                            <>
                                <div ref={sentinelRef} aria-hidden='true' className='h-px' />
                                <div className='flex justify-center pt-2'>
                                    <Button size='sm' variant='ghost' onClick={() => fetchNextPage()} className='text-muted-foreground'>
                                        더 보기
                                    </Button>
                                </div>
                            </>
                        ) : null}

                        {!hasNextPage && !isError ? (
                            <p className='text-muted-foreground/60 py-6 text-center text-xs'>마지막 기사입니다</p>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    )
}
