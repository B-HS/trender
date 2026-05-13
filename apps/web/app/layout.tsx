import { Geist_Mono, Inter } from "next/font/google"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteNav } from "@/components/site-nav"
import { cn } from "@workspace/ui/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: "Trender — AI 트렌드 자동 수집",
  description: "한·일·영 AI 트렌드를 자동 수집·요약·진화시키는 리포트 대시보드",
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
          <div className="min-h-svh bg-background">
            <SiteNav />
            <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}

export default RootLayout
