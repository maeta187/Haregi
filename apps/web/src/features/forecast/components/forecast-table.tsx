import { formatJstDate, formatTemperature } from '@haregi/schema'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx'
import type { Forecast } from '../api/forecast-api.ts'

export function ForecastTable({ days }: { days: Forecast['days'] }) {
  return (
    <div className="@container">
      <Table className="forecast-table tabular-nums">
        <TableCaption className="sr-only">週間の最高・最低気温</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">日付</TableHead>
            <TableHead scope="col">最高気温</TableHead>
            <TableHead scope="col">最低気温</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map((day) => (
            <TableRow key={day.date}>
              <TableHead scope="row">
                <time dateTime={day.date}>{formatJstDate(day.date)}</time>
              </TableHead>
              <TableCell>
                <span className="@min-[600px]:hidden" aria-hidden="true">
                  最高気温{' '}
                </span>
                {day.maxTemperature === null
                  ? '—'
                  : formatTemperature(day.maxTemperature)}
              </TableCell>
              <TableCell>
                <span className="@min-[600px]:hidden" aria-hidden="true">
                  最低気温{' '}
                </span>
                {day.minTemperature === null
                  ? '—'
                  : formatTemperature(day.minTemperature)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
