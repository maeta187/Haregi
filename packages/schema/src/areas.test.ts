import { describe, expect, it } from 'vitest'

import { areas, findArea, resolveForecastCode } from '@haregi/schema'

describe('地域マスタ', () => {
  it('全58地域を重複のない6桁数字のコードで公開する', () => {
    expect(areas).toHaveLength(58)

    const codes = areas.map((area) => area.code)
    expect(codes.every((code) => /^\d{6}$/.test(code))).toBe(true)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('地域コードから既知の地域を取得する', () => {
    expect(findArea('130000')).toMatchObject({
      code: '130000',
      name: '東京都',
    })
  })

  it('未知の地域コードでは地域を返さない', () => {
    expect(findArea('999999')).toBeUndefined()
  })

  it.each([
    ['130000', '130000'],
    ['460040', '460100'],
    ['014030', '014100'],
  ])('%s の予報取得コードとして %s を返す', (areaCode, forecastCode) => {
    expect(resolveForecastCode(areaCode)).toBe(forecastCode)
  })
})
