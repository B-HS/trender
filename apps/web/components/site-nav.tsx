import Link from "next/link"

export const SiteNav = () => {
  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4 text-sm">
        <Link href="/" className="font-semibold">
          Trender
        </Link>
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          리포트
        </Link>
        <Link href="/articles" className="text-muted-foreground hover:text-foreground">
          기사
        </Link>
        <Link href="/sources" className="text-muted-foreground hover:text-foreground">
          소스 진화
        </Link>
      </nav>
    </header>
  )
}
