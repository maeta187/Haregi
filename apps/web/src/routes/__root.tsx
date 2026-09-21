import { QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'

import appCss from '../styles.css?url'
import { AppNav } from '@/components/app-nav.tsx'
import { Toaster } from '@/components/ui/sonner'
import { useLogout } from '@/features/auth/hooks/use-logout.ts'
import { useSession } from '@/features/auth/hooks/use-session.ts'
import { createQueryClient } from '@/lib/query-client.ts'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Haregi(ハレギ)' },
      {
        name: 'description',
        content:
          '週間の天気予報(最高・最低気温)を見ながら、日ごとの服装コーディネートを記録・管理する Web アプリです。',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: ReactNode }) {
  // SSR とクライアントでインスタンスを共有しないよう、レンダリングごとに1つ作る
  const [queryClient] = useState(createQueryClient)

  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground min-h-svh">
        <QueryClientProvider client={queryClient}>
          {children}
          {/* トーストはアプリ全体で1箇所だけマウントする(ui-web.md) */}
          <Toaster position="top-center" />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  const { user } = useSession()
  const logout = useLogout()

  return (
    <div className="flex min-h-svh flex-col">
      <AppNav user={user} onLogout={() => logout.mutate(undefined)} />
      <div className="flex-1">
        <Outlet />
      </div>
      <SourceAttribution />
    </div>
  )
}

/** 政府標準利用規約の要件。予報の有無にかかわらず常時表示する(jma-forecast.md)。 */
function SourceAttribution() {
  return (
    <footer className="border-border/60 text-muted-foreground border-t px-4 py-4 text-center text-xs">
      出典: 気象庁ホームページ
    </footer>
  )
}
