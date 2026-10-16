import { findArea } from '@haregi/schema'
import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '@/features/auth/hooks/require-session.ts'
import { useForecast } from '@/features/forecast/hooks/use-forecast.ts'
import { ForecastSection } from '@/features/forecast/components/forecast-section.tsx'

export const Route = createFileRoute('/forecast')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { area?: string | undefined } => {
    // Routerは数値形式のsearch値をJSONとして解析する。先頭0のコードは文字列のまま扱う。
    const area =
      typeof search.area === 'number' ? String(search.area) : search.area
    return {
      area: typeof area === 'string' && findArea(area) ? area : undefined,
    }
  },
  beforeLoad: async () => ({ user: await requireSession() }),
  component: ForecastPage,
})

function ForecastPage() {
  const { user } = Route.useRouteContext()
  const { area: selectedArea } = Route.useSearch()
  const navigate = Route.useNavigate()
  const area = selectedArea ?? user.areaCode
  const forecast = useForecast(area)
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="font-heading mb-6 text-2xl font-semibold">
        週間予報とコーデ
      </h1>
      <ForecastSection
        {...forecast}
        area={area}
        onAreaChange={(nextArea) => {
          void navigate({ search: { area: nextArea || undefined } })
        }}
        onRetry={() => {
          void forecast.refetch()
        }}
      />
    </main>
  )
}
