// 気象庁の系列構造を保った最小 fixture。先頭には別区域・別地点を置く。
import { findArea } from '@haregi/schema'
export function jmaFixture(code = '130000') {
  const area = findArea(code)!
  const series = (
    times: string[],
    code: string,
    values: Record<string, string[]>,
  ) => ({
    timeDefines: times,
    areas: [
      {
        area: { code: 'other' },
        ...Object.fromEntries(
          Object.keys(values).map((k) => [k, times.map(() => '99')]),
        ),
      },
      { area: { code }, ...values },
    ],
  })
  return [
    {
      reportDatetime: '2026-10-11T11:00:00+09:00',
      timeSeries: [
        series(
          ['2026-10-11T11:00:00+09:00', '2026-10-12T00:00:00+09:00'],
          area.weatherArea,
          { weatherCodes: ['100', '101'] },
        ),
        series(
          [
            '2026-10-11T09:00:00+09:00',
            '2026-10-11T00:00:00+09:00',
            '2026-10-12T00:00:00+09:00',
            '2026-10-12T09:00:00+09:00',
          ],
          area.tempStation,
          { temps: ['27', '27', '17', '26'] },
        ),
      ],
    },
    {
      reportDatetime: '2026-10-11T11:00:00+09:00',
      timeSeries: [
        series(
          ['2026-10-12T00:00:00+09:00', '2026-10-13T00:00:00+09:00'],
          area.weeklyArea,
          { weatherCodes: ['101', '201'] },
        ),
        series(
          ['2026-10-12T00:00:00+09:00', '2026-10-13T00:00:00+09:00'],
          area.tempStation,
          { tempsMin: ['', '16'], tempsMax: ['', '25'] },
        ),
      ],
    },
  ]
}
