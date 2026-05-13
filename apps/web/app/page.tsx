import Link from "next/link"
import { desc } from "drizzle-orm"
import { reports } from "@workspace/db"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"

export const dynamic = "force-dynamic"

const KIND_LABEL: Record<string, string> = {
  daily: "일간",
  weekly: "주간",
  monthly: "월간",
}

const formatDate = (d: Date | string) => new Date(d).toLocaleDateString("ko-KR")

const stripMarkdown = (md: string) => md.replace(/[#*`_>\-]/g, "").replace(/\s+/g, " ").trim()

const Page = async () => {
  const rows = await db.select().from(reports).orderBy(desc(reports.createdAt)).limit(50)

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">리포트</h1>
        <p className="text-muted-foreground text-sm">
          아직 생성된 리포트가 없습니다. 파서가 한 번 이상 실행되어야 표시됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold sm:text-3xl">최신 리포트</h1>
      <div className="grid gap-3 sm:gap-4">
        {rows.map((r) => (
          <Link key={r.id} href={`/reports/${r.id}`} className="group">
            <Card className="transition-colors group-hover:bg-accent">
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{KIND_LABEL[r.kind] ?? r.kind}</Badge>
                  <CardDescription>
                    {formatDate(r.periodStart)} ~ {formatDate(r.periodEnd)}
                  </CardDescription>
                </div>
                <CardTitle className="text-base leading-snug sm:text-lg">{r.titleKo}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                {stripMarkdown(r.markdownKo).slice(0, 200)}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default Page
