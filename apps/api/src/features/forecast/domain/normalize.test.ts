import { describe, expect, it } from 'vitest'
import { findArea } from '@haregi/schema'
import { jmaFixture } from '../fixtures/jma.ts'
import { normalizeForecast } from './normalize.ts'

describe('気象庁予報の正規化', () => {
  it('前日発表の週間に値があっても翌朝更新された短期気温と発表時刻を採用する', () => {
    const fixture = jmaFixture()
    fixture[0]!.reportDatetime = '2026-10-11T05:00:00+09:00'
    fixture[1]!.reportDatetime = '2026-10-10T17:00:00+09:00'
    Object.assign(fixture[1]!.timeSeries[1]!.areas[1]!, {
      tempsMax: ['25', '25'],
      tempsMin: ['16', '16'],
    })
    const result = normalizeForecast(fixture, findArea('130000')!)
    expect(result.days[1]).toMatchObject({
      date: '2026-10-12',
      maxTemperature: 26,
      minTemperature: 17,
    })
    expect(result.forecastIssuedAt).toEqual(new Date('2026-10-10T20:00:00Z'))
  })
  it('区域と地点をマスタで選び、週間と短期気温を JST の暦日で統合する', () => {
    const result = normalizeForecast(jmaFixture(), findArea('130000')!)
    expect(result.days).toEqual([
      {
        date: '2026-10-11',
        maxTemperature: 27,
        minTemperature: null,
        weatherCode: '100',
      },
      {
        date: '2026-10-12',
        maxTemperature: 26,
        minTemperature: 17,
        weatherCode: '101',
      },
      {
        date: '2026-10-13',
        maxTemperature: 25,
        minTemperature: 16,
        weatherCode: '201',
      },
    ])
    expect(result.forecastIssuedAt).toEqual(new Date('2026-10-11T02:00:00Z'))
    expect(result).toMatchObject({ areaCode: '130000', tempStation: '44132' })
  })
  it.each([
    {
      shortAt: '2026-10-11T17:00:00+09:00',
      weeklyAt: '2026-10-12T05:00:00+09:00',
      temps: ['17', '26'],
      expected: [16, 25],
    },
    {
      shortAt: '2026-10-11T11:00:00+09:00',
      weeklyAt: '2026-10-11T11:00:00+09:00',
      temps: ['17', '26'],
      expected: [17, 26],
    },
    {
      shortAt: '2026-10-12T05:00:00+09:00',
      weeklyAt: '2026-10-11T17:00:00+09:00',
      temps: ['', '26'],
      expected: [16, 26],
    },
    {
      shortAt: '2026-10-12T05:00:00+09:00',
      weeklyAt: '2026-10-11T17:00:00+09:00',
      temps: ['-5', '0'],
      expected: [-5, 0],
    },
  ])(
    '発表時刻と欠損を気温ごとに比較する: %j',
    ({ shortAt, weeklyAt, temps, expected }) => {
      const fixture = jmaFixture()
      fixture[0]!.reportDatetime = shortAt
      fixture[1]!.reportDatetime = weeklyAt
      Object.assign(fixture[0]!.timeSeries[1]!.areas[1]!, {
        temps: ['27', '27', ...temps],
      })
      Object.assign(fixture[1]!.timeSeries[1]!.areas[1]!, {
        tempsMin: ['16', '16'],
        tempsMax: ['25', '25'],
      })
      const result = normalizeForecast(fixture, findArea('130000')!)
      expect(result.days[1]).toMatchObject({
        minTemperature: expected[0],
        maxTemperature: expected[1],
      })
      expect(result.forecastIssuedAt.getTime()).toBe(
        Math.max(Date.parse(shortAt), Date.parse(weeklyAt)),
      )
    },
  )
})

it.each(['460040', '014030'])(
  '親区分に同居する %s も先頭区域と混同しない',
  (code) => {
    expect(normalizeForecast(jmaFixture(code), findArea(code)!)).toMatchObject({
      areaCode: code,
      tempStation: findArea(code)!.tempStation,
      days: [
        expect.objectContaining({ maxTemperature: 27 }),
        expect.anything(),
        expect.anything(),
      ],
    })
  },
)
it('短期にもない欠損は null にし、0℃と負の気温は保持する', () => {
  const fixture = jmaFixture()
  const weekly = fixture[1]!.timeSeries[1]!.areas[1]!
  Object.assign(weekly, { tempsMax: ['', '0'], tempsMin: ['', '-5'] })
  Object.assign(fixture[0]!.timeSeries[1]!.areas[1]!, {
    temps: ['', '', '', ''],
  })
  const result = normalizeForecast(fixture, findArea('130000')!)
  expect(result.days[0]).toMatchObject({
    maxTemperature: null,
    minTemperature: null,
  })
  expect(result.days[1]).toMatchObject({
    maxTemperature: null,
    minTemperature: null,
  })
  expect(result.days[2]).toMatchObject({
    maxTemperature: 0,
    minTemperature: -5,
  })
})
it.each([null, [], [{}, {}]])(
  '壊れた入力を空の正常予報にしない: %j',
  (input) => {
    expect(() => normalizeForecast(input, findArea('130000')!)).toThrow()
  },
)
it('対象地点が欠けたら他地点へフォールバックしない', () => {
  expect(() => normalizeForecast(jmaFixture(), findArea('460040')!)).toThrow()
})

it('UTC 表記の発表・対象時刻も JST の同じ暦日に正規化する', () => {
  const fixture = jmaFixture()
  const expected = normalizeForecast(fixture, findArea('130000')!)
  for (const report of fixture) {
    report.reportDatetime = new Date(report.reportDatetime).toISOString()
    for (const series of report.timeSeries) {
      series.timeDefines = series.timeDefines.map((time) =>
        new Date(time).toISOString(),
      )
    }
  }
  expect(normalizeForecast(fixture, findArea('130000')!)).toEqual(expected)
})

it('空の系列を正常な空予報として受け付けない', () => {
  const fixture = jmaFixture()
  for (const report of fixture) {
    for (const series of report.timeSeries) {
      series.timeDefines = []
      for (const area of series.areas) {
        for (const key of Object.keys(area)) {
          if (key !== 'area') Object.assign(area, { [key]: [] })
        }
      }
    }
  }
  expect(() => normalizeForecast(fixture, findArea('130000')!)).toThrow()
})
