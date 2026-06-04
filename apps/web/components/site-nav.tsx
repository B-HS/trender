import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { AuthNav } from "@/components/auth/auth-nav"

export const SiteNav = () => {
  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3 text-sm sm:gap-6">
        <Link href="/" className="font-semibold">
          Trender
        </Link>
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          리포트
        </Link>
        <Link href="/articles" className="text-muted-foreground hover:text-foreground">
          기사
        </Link>
        <Link href="/favorites" className="text-muted-foreground hover:text-foreground">
          책갈피
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <AuthNav />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
