import type { Area } from '@haregi/schema'
import type { ForecastDay, NormalizedForecast } from './forecast.ts'

type JmaArea = { area: { code: string }; [key: string]: unknown }
type Series = { timeDefines: string[]; areas: JmaArea[] }
type Report = { reportDatetime: string; timeSeries: Series[] }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
function reports(value: unknown): asserts value is [Report, Report] {
  if (!Array.isArray(value) || value.length !== 2)
    throw new Error('予報は短期・週間の2要素が必要です')
  for (const report of value) {
    if (
      !record(report) ||
      typeof report['reportDatetime'] !== 'string' ||
      !Number.isFinite(Date.parse(report['reportDatetime'])) ||
      !Array.isArray(report['timeSeries'])
    )
      throw new Error('予報の構造が不正です')
    for (const series of report['timeSeries']) {
      if (
        !record(series) ||
        !Array.isArray(series['timeDefines']) ||
        series['timeDefines'].length === 0 ||
        !series['timeDefines'].every(
          (t) => typeof t === 'string' && Number.isFinite(Date.parse(t)),
        ) ||
        !Array.isArray(series['areas']) ||
        !series['areas'].every(
          (a) =>
            record(a) &&
            record(a['area']) &&
            typeof a['area']['code'] === 'string',
        )
      )
        throw new Error('予報系列の構造が不正です')
    }
  }
}
function select(report: Report, code: string, key: string) {
  for (const series of report.timeSeries) {
    const area = series.areas.find((a) => a.area.code === code && key in a)
    if (area) return { series, area }
  }
  throw new Error(`予報系列がありません: ${code}/${key}`)
}
function values(area: JmaArea, key: string, length: number): string[] {
  const data = area[key]
  if (
    !Array.isArray(data) ||
    data.length !== length ||
    !data.every((v) => typeof v === 'string')
  )
    throw new Error(`予報値が不正です: ${key}`)
  return data
}
function temperature(value: string | undefined): number | null {
  if (value === '' || value === '-') return null
  if (value === undefined || !/^-?\d+(\.\d+)?$/.test(value))
    throw new Error('気温が不正です')
  return Number(value)
}
const jst = (time: string) =>
  new Date(Date.parse(time) + 9 * 60 * 60 * 1000).toISOString()

export function normalizeForecast(
  input: unknown,
  area: Area,
): NormalizedForecast {
  reports(input)
  const [short, weekly] = input
  const shortIssuedAt = Date.parse(short.reportDatetime)
  const weeklyIssuedAt = Date.parse(weekly.reportDatetime)
  const days = new Map<string, ForecastDay>()
  const day = (time: string) => {
    const date = jst(time).slice(0, 10)
    let entry = days.get(date)
    if (!entry) {
      entry = {
        date,
        maxTemperature: null,
        minTemperature: null,
        weatherCode: null,
      }
      days.set(date, entry)
    }
    return entry
  }
  for (const [report, code] of [
    [weekly, area.weeklyArea],
    [short, area.weatherArea],
  ] as const) {
    const selected = select(report, code, 'weatherCodes')
    const codes = values(
      selected.area,
      'weatherCodes',
      selected.series.timeDefines.length,
    )
    selected.series.timeDefines.forEach((time, i) => {
      day(time).weatherCode = codes[i] || null
    })
  }
  const wt = select(weekly, area.tempStation, 'tempsMax')
  const max = values(wt.area, 'tempsMax', wt.series.timeDefines.length)
  const min = values(wt.area, 'tempsMin', wt.series.timeDefines.length)
  wt.series.timeDefines.forEach((time, i) => {
    Object.assign(day(time), {
      maxTemperature: temperature(max[i]),
      minTemperature: temperature(min[i]),
    })
  })
  const st = select(short, area.tempStation, 'temps')
  const temps = values(st.area, 'temps', st.series.timeDefines.length)
  st.series.timeDefines.forEach((time, i, times) => {
    const local = jst(time)
    // 昼の短期予報は当日最高を 09時→00時の2枠で繰り返す。00時の枠を最低と誤認しない。
    const duplicateMaximum =
      local.slice(11, 13) === '00' &&
      times
        .slice(0, i)
        .some(
          (t) =>
            jst(t).slice(0, 10) === local.slice(0, 10) &&
            jst(t).slice(11, 13) === '09',
        )
    if (duplicateMaximum) return
    const key =
      local.slice(11, 13) === '09' ? 'maxTemperature' : 'minTemperature'
    const value = temperature(temps[i])
    const entry = day(time)
    // 同時発表なら詳細な短期を優先し、新しい予報の欠損は既存値を消さない。
    if (
      value !== null &&
      (entry[key] === null || shortIssuedAt >= weeklyIssuedAt)
    )
      entry[key] = value
  })
  return {
    areaCode: area.code,
    tempStation: area.tempStation,
    // 短期・週間を統合した予報の最新発表時刻。
    forecastIssuedAt: new Date(Math.max(shortIssuedAt, weeklyIssuedAt)),
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }
}
