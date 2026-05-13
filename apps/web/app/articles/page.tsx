import { desc } from "drizzle-orm"
import { articles } from "@workspace/db"
import { db } from "@/lib/db"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

export const dynamic = "force-dynamic"

const LANG_LABEL: Record<string, string> = { ko: "한국어", ja: "일본어", en: "영어" }

const Page = async () => {
  const rows = await db.select().from(articles).orderBy(desc(articles.fetchedAt)).limit(100)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">수집된 기사</h1>
        <p className="text-muted-foreground text-sm">
          최근 수집된 기사 100건. 한국어 요약이 있으면 함께 표시됩니다.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((a) => (
          <Card key={a.id} className="overflow-hidden">
            <CardHeader className="gap-2 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{LANG_LABEL[a.lang] ?? a.lang}</Badge>
                {a.publishedAt ? (
                  <span className="text-muted-foreground text-xs">
                    {new Date(a.publishedAt).toLocaleDateString("ko-KR")}
                  </span>
                ) : null}
              </div>
              <CardTitle className="text-base leading-snug">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="wrap-break-word hover:underline"
                >
                  {a.titleKo || a.titleOriginal}
                </a>
              </CardTitle>
            </CardHeader>
            {a.summaryKo ? (
              <CardContent className="text-muted-foreground text-sm leading-relaxed">
                {a.summaryKo}
              </CardContent>
            ) : (
              <CardContent className="text-muted-foreground text-xs italic">아직 요약 대기</CardContent>
            )}
          </Card>
        ))}
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">아직 수집된 기사가 없습니다.</p>
        ) : null}
      </div>
    </div>
  )
}

export default Page
