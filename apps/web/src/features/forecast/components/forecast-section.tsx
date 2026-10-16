import { AreaSelect } from '@/components/area-select.tsx'
import { Label } from '@/components/ui/label.tsx'
import { Skeleton } from '@/components/ui/skeleton.tsx'
import type { Forecast } from '../api/forecast-api.ts'

import { ForecastTable } from './forecast-table.tsx'
import { ForecastMeta } from './forecast-meta.tsx'
import { ForecastError } from './forecast-error.tsx'

type ForecastSectionProps = {
  area: string
  forecast: Forecast | undefined
  isPending: boolean
  error: Error | null
  isStale: boolean
  onAreaChange: (area: string) => void
  onRetry: () => void
}

export function ForecastSection({
  area,
  forecast,
  isPending,
  error,
  isStale,
  onAreaChange,
  onRetry,
}: ForecastSectionProps) {
  return (
    <section aria-label="週間予報" className="flex flex-col gap-6">
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="forecast-area">表示地域</Label>
        <AreaSelect
          id="forecast-area"
          value={area}
          onChange={(event) => onAreaChange(event.target.value)}
        />
        <p className="text-muted-foreground text-sm">
          表示地域を切り替えても、登録地域は変わりません。
        </p>
      </div>
      {isPending && (
        <output className="flex flex-col gap-3">
          <p>予報を読み込んでいます</p>
          <Skeleton
            aria-hidden="true"
            className="h-80 w-full motion-reduce:animate-none"
          />
        </output>
      )}
      {error && <ForecastError onRetry={onRetry} />}
      {forecast && (
        <>
          <ForecastMeta
            forecastIssuedAt={forecast.forecastIssuedAt}
            isStale={isStale || error !== null}
          />
          <ForecastTable days={forecast.days} />
        </>
      )}
      <p className="text-muted-foreground text-sm">
        <a
          href="https://www.jma.go.jp/"
          className="underline underline-offset-4"
        >
          出典: 気象庁ホームページ
        </a>
      </p>
    </section>
  )
}
