import { Geist_Mono, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { QueryProvider } from "@/components/query-provider"
import { SiteNav } from "@/components/site-nav"
import { BackToTop } from "@/components/back-to-top"
import { AuthProvider } from "@/components/auth/auth-provider"
import { cn } from "@workspace/ui/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: { default: "Trender — AI 트렌드 자동 수집", template: "%s · Trender" },
  description: "한·일·영 AI 트렌드를 자동 수집하고 언어별 리포트를 생성하는 대시보드",
}

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <div className="min-h-svh bg-background">
                <SiteNav />
                <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
                <BackToTop />
              </div>
            </AuthProvider>
          </QueryProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}

export default RootLayout
