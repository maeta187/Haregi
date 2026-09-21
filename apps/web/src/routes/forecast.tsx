import { createFileRoute } from '@tanstack/react-router'

import { requireSession } from '@/features/auth/hooks/require-session.ts'

/**
 * メイン画面(週間予報 + コーデ入力)。
 *
 * フェーズ4b では認証ガードの下地のみを置く。予報表示部はフェーズ5b、
 * コーデ入力部はフェーズ6b で実装する(implementation-plan.md)。
 */
export const Route = createFileRoute('/forecast')({
  beforeLoad: async () => ({ user: await requireSession() }),
  component: ForecastPage,
})

function ForecastPage() {
  const { user } = Route.useRouteContext()

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="font-heading mb-6 text-2xl font-semibold">
        週間予報とコーデ
      </h1>
      <p className="text-muted-foreground text-sm">
        {user.name} さんの登録地域: {user.areaCode}
      </p>
      <p className="text-muted-foreground mt-4 text-sm">
        予報の表示はフェーズ5、コーデの入力はフェーズ6で実装します。
      </p>
    </main>
  )
}
