import { formatJstDateTime } from '@haregi/schema'

export function ForecastMeta({
  forecastIssuedAt,
  isStale,
}: {
  forecastIssuedAt: string
  isStale: boolean
}) {
  return (
    <div className="text-muted-foreground flex flex-col gap-1 text-sm">
      <p>
        <time dateTime={forecastIssuedAt}>
          {formatJstDateTime(forecastIssuedAt)}
        </time>
        {isStale ? '時点の予報(最新を取得できませんでした)' : '発表'}
      </p>
      <p>地域の代表地点(アメダス)の予報</p>
    </div>
  )
}
