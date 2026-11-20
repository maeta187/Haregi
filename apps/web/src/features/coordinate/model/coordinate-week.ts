import { shiftJstDay } from '@haregi/schema'
import type { Coordinate, CoordinateValues } from '../api/coordinate-api.ts'

export function coordinateWeek(from: string) {
  return Array.from({ length: 7 }, (_, offset) => shiftJstDay(from, offset))
}

export function coordinateFormValues(
  dates: string[],
  saved: Coordinate[],
): CoordinateValues {
  const byDate = new Map(saved.map((item) => [item.date, item]))
  return {
    items: dates.map((date) => {
      const item = byDate.get(date)
      return {
        date,
        outerwear: item?.outerwear ?? '',
        tops: item?.tops ?? '',
        bottoms: item?.bottoms ?? '',
        ...(item && { version: item.version }),
      }
    }),
  }
}
