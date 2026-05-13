import { notFound } from "next/navigation"
import Link from "next/link"
import { asc, eq } from "drizzle-orm"
import { reports, reportItems, articles } from "@workspace/db"
import { db } from "@/lib/db"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Markdown } from "@/components/markdown"

export const dynamic = "force-dynamic"

const KIND_LABEL: Record<string, string> = {
  daily: "일간",
  weekly: "주간",
  monthly: "월간",
}

const LANG_LABEL: Record<string, string> = { ko: "한국어", ja: "일본어", en: "영어" }

const formatDate = (d: Date | string) => new Date(d).toLocaleDateString("ko-KR")

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const reportId = Number(id)
  if (!Number.isFinite(reportId)) notFound()

  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1)
  if (!report) notFound()

  const items = await db
    .select({
      rank: reportItems.rank,
      url: articles.url,
      lang: articles.lang,
      titleKo: articles.titleKo,
      titleOriginal: articles.titleOriginal,
      summaryKo: articles.summaryKo,
    })
    .from(reportItems)
    .innerJoin(articles, eq(reportItems.articleId, articles.id))
    .where(eq(reportItems.reportId, reportId))
    .orderBy(asc(reportItems.rank))

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <div className="flex flex-col gap-3">
        <Link href="/" className="text-muted-foreground w-fit text-sm hover:underline">
          ← 리포트 목록
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{KIND_LABEL[report.kind] ?? report.kind}</Badge>
          <span className="text-muted-foreground text-sm">
            {formatDate(report.periodStart)} ~ {formatDate(report.periodEnd)}
          </span>
        </div>
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{report.titleKo}</h1>
      </div>

      <Markdown source={report.markdownKo} />

      <Separator />

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-semibold">채택 기사</h2>
          <span className="text-muted-foreground text-sm">{items.length}건</span>
        </div>
        <div className="flex flex-col gap-3">
          {items.map((it) => (
            <Card key={it.rank} className="overflow-hidden">
              <CardHeader className="gap-2 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">#{it.rank}</Badge>
                  <Badge variant="secondary">{LANG_LABEL[it.lang] ?? it.lang}</Badge>
                </div>
                <CardTitle className="text-base leading-snug sm:text-lg">
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="wrap-break-word hover:underline"
                  >
                    {it.titleKo || it.titleOriginal}
                  </a>
                </CardTitle>
              </CardHeader>
              {it.summaryKo ? (
                <CardContent className="text-muted-foreground text-sm leading-relaxed">
                  {it.summaryKo}
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Page
