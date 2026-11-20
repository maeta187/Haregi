import { useState } from 'react'
import { todayJst } from '@haregi/schema'
import { useQuery } from '@tanstack/react-query'
import { fetchCoordinates } from '../api/coordinate-api.ts'
import { coordinateWeek } from '../model/coordinate-week.ts'

export function useCoordinateWeek(userId: string) {
  const [from] = useState(todayJst)
  const dates = coordinateWeek(from)
  const to = dates[6]!
  const query = useQuery({
    queryKey: ['coordinates', userId, from, to],
    queryFn: () => fetchCoordinates({ from, to }),
    // 編集を開始したときの版を、編集中の自動取得で入れ替えない。
    staleTime: Infinity,
    gcTime: 0,
  })
  return { dates, query }
}
