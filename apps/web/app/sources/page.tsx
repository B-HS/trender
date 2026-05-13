import { asc } from "drizzle-orm"
import { sources } from "@workspace/db"
import { db } from "@/lib/db"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export const dynamic = "force-dynamic"

const STAGE_LABEL: Record<string, string> = {
  candidate: "후보",
  active: "활성",
  demoted: "강등",
}

const STAGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  candidate: "outline",
  active: "default",
  demoted: "destructive",
}

const KIND_LABEL: Record<string, string> = { keyword: "키워드", web: "웹" }

const Page = async () => {
  const rows = await db.select().from(sources).orderBy(asc(sources.stage), asc(sources.kind))
  const grouped = {
    active: rows.filter((r) => r.stage === "active"),
    candidate: rows.filter((r) => r.stage === "candidate"),
    demoted: rows.filter((r) => r.stage === "demoted"),
  }

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">정보 소스 진화 현황</h1>
        <p className="text-muted-foreground text-sm">
          파서가 매일 새로운 키워드/웹 소스를 발견·승격·강등시킵니다.
        </p>
      </div>
      {(["active", "candidate", "demoted"] as const).map((stage) => (
        <section key={stage} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={STAGE_VARIANT[stage]}>{STAGE_LABEL[stage]}</Badge>
            <span className="text-muted-foreground text-sm">{grouped[stage].length}건</span>
          </div>
          <div className="-mx-3 overflow-x-auto sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">종류</TableHead>
                  <TableHead>값</TableHead>
                  <TableHead className="w-20">언어</TableHead>
                  <TableHead className="w-32">승격일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped[stage].map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{KIND_LABEL[r.kind] ?? r.kind}</TableCell>
                    <TableCell className="break-all font-mono text-xs">{r.value}</TableCell>
                    <TableCell>{r.lang ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {r.promotedAt ? new Date(r.promotedAt).toLocaleDateString("ko-KR") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {grouped[stage].length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-center text-xs">
                      없음
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
    </div>
  )
}

export default Page
