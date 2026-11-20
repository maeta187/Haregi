import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchForecast } from '../api/forecast-api.ts'

export function useForecast(area: string) {
  const client = useQueryClient()
  const options = queryOptions({
    queryKey: ['forecast', area],
    queryFn: () => fetchForecast(area),
  })
  const query = useQuery(options)
  return {
    forecast: query.data,
    snapshotId: query.data?.snapshotId,
    isPending: query.isPending,
    error: query.error,
    isStale: query.data?.status === 'stale',
    refetch: query.refetch,
    refreshSnapshot: async () => {
      // 保存を開始した時点の表示地域を再取得する。
      const refreshed = await client.fetchQuery({ ...options, staleTime: 0 })
      return refreshed.snapshotId
    },
  }
}
