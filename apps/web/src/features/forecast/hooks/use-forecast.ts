import { useQuery } from '@tanstack/react-query'
import { fetchForecast } from '../api/forecast-api.ts'

export function useForecast(area: string) {
  const query = useQuery({
    queryKey: ['forecast', area],
    queryFn: () => fetchForecast(area),
  })
  return {
    forecast: query.data,
    snapshotId: query.data?.snapshotId,
    isPending: query.isPending,
    error: query.error,
    isStale: query.data?.status === 'stale',
    refetch: query.refetch,
  }
}
