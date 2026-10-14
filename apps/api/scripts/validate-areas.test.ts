import { expect, it, vi } from 'vitest'
import { findArea } from '@haregi/schema'
import { jmaFixture } from '../src/features/forecast/fixtures/jma.ts'
import { validateAreas } from './validate-areas.ts'

it('既存マスタを再生成せず、親区分 URL と各系列・地点の対応を検証する', async () => {
  const fetcher = vi.fn(async () => Response.json(jmaFixture('460040')))
  const results = await validateAreas([findArea('460040')!], {
    fetcher,
    sleep: async () => {},
  })
  expect(results).toEqual([
    { code: '460040', name: '奄美地方', forecastCode: '460100', ok: true },
  ])
  expect(fetcher.mock.calls).toHaveLength(1)
})
it('マスタの地点が消えた場合は検証失敗を報告する', async () => {
  const fetcher = vi.fn(async () => Response.json(jmaFixture('130000')))
  const results = await validateAreas([findArea('460040')!], {
    fetcher,
    sleep: async () => {},
  })
  expect(results[0]).toMatchObject({
    code: '460040',
    ok: false,
    error: expect.any(String),
  })
})
