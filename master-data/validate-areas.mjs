// 気象庁 府県予報区マスタの検証・生成スクリプト
// 全 offices の予報 JSON を実取得し、地域マスタ(取得コード/一次細分区域/週間区域/代表アメダス地点)の
// 対応が機械的に解決できるかを検証して areas.ts と validation-report.md を生成する。
// 将来 apps/api/scripts/validate-areas.ts へ移植する前提の暫定版(Node 22 / .mjs)。
//
// 実行: node master-data/validate-areas.mjs
//
// 検証で判明した構造仕様(2026-07-19):
// - 奄美(460040)・十勝(014030)は自分の予報 JSON を持たず(404)、親区分のレスポンスに同居する
// - 週間予報の天気・降水確率は広域(府県予報区単位等)に統合される区分が大半
//   → 解決規則: office コード一致 → 一次細分区域コード一致 → 先頭区域

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = dirname(fileURLToPath(import.meta.url))
const AREA_JSON_URL = 'https://www.jma.go.jp/bosai/common/const/area.json'
const forecastUrl = (code) => `https://www.jma.go.jp/bosai/forecast/data/forecast/${code}.json`
const DELAY_MS = 300 // 気象庁サーバーへの配慮

// 自分の予報 JSON を持たない office → 同居先の取得コード
const FETCH_ALIAS = {
  '014030': '014100', // 十勝地方 → 釧路・根室地方のファイルに同居
  '460040': '460100' // 奄美地方 → 鹿児島県のファイルに同居
}

// 同居ファイル内で複数地点から選ぶ際の代表アメダス地点(地理的に当該 office 内の地点)
const TEMP_OVERRIDE = {
  '014030': '20432', // 帯広
  '460040': '88837' // 名瀬
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** timeSeries から指定キーを持つ系列を探す */
const findSeries = (timeSeries, key) => timeSeries.find((ts) => ts.areas.some((a) => key in a))

/** 空文字・"-" を欠損として数える */
const countMissing = (values = []) => values.filter((v) => v === '' || v === '-').length

/** 区域リストから office に対応する区域を解決(office コード一致 → 指定コード一致 → 先頭) */
function resolveArea(areas, officeCode, fallbackCode) {
  return (
    areas.find((a) => a.area.code === officeCode) ??
    areas.find((a) => a.area.code === fallbackCode) ??
    areas[0]
  )
}

async function validateOffice(code, name, cache) {
  const fetchCode = FETCH_ALIAS[code] ?? code
  const result = { code, name, fetchCode, flags: [], notes: [] }

  let data
  try {
    data = cache.get(fetchCode) ?? (await fetchJson(forecastUrl(fetchCode)))
    cache.set(fetchCode, data)
  } catch (e) {
    result.flags.push(`取得失敗: ${e.message}`)
    return result
  }

  if (!Array.isArray(data) || data.length < 2) {
    result.flags.push(`レスポンスが [短期, 週間] の2要素でない (length=${Array.isArray(data) ? data.length : typeof data})`)
    return result
  }

  const [short, weekly] = data

  // --- 短期の天気(一次細分区域)の解決 ---
  const shortWeather = findSeries(short.timeSeries, 'weathers') ?? findSeries(short.timeSeries, 'weatherCodes')
  if (!shortWeather) {
    result.flags.push('短期予報に天気系列がない')
    return result
  }
  const wa = resolveArea(shortWeather.areas, code).area
  result.weatherArea = wa.code
  result.weatherAreaName = wa.name

  // --- 週間の天気区域の解決(広域統合されるため別コードになる) ---
  const weeklyWeather = findSeries(weekly.timeSeries, 'weatherCodes')
  if (!weeklyWeather) {
    result.flags.push('週間予報に weatherCodes 系列がない')
    return result
  }
  const wwa = resolveArea(weeklyWeather.areas, code, result.weatherArea).area
  result.weeklyArea = wwa.code
  result.weeklyAreaName = wwa.name
  if (wwa.code !== code && wwa.code !== result.weatherArea) {
    result.notes.push(`週間区域は先頭フォールバック: ${wwa.name}(${wwa.code})`) // 要目視確認(福島など)
  }

  // --- 気温(アメダス地点)の解決: 短期・週間の両方に存在する地点から選ぶ ---
  const shortTemp = findSeries(short.timeSeries, 'temps')
  const weeklyTemp = findSeries(weekly.timeSeries, 'tempsMax')
  if (!shortTemp || !weeklyTemp) {
    result.flags.push(`気温系列がない (短期temps: ${!!shortTemp} / 週間tempsMax: ${!!weeklyTemp})`)
    return result
  }
  const weeklyCodes = new Set(weeklyTemp.areas.map((a) => a.area.code))
  const common = shortTemp.areas.filter((a) => weeklyCodes.has(a.area.code))
  if (common.length === 0) {
    result.flags.push(
      `短期と週間で共通のアメダス地点がない (短期: ${shortTemp.areas.map((a) => a.area.name).join('/')} 週間: ${weeklyTemp.areas.map((a) => a.area.name).join('/')})`
    )
    return result
  }
  const override = TEMP_OVERRIDE[code]
  const pick = override ? common.find((a) => a.area.code === override) : common[0]
  if (!pick) {
    result.flags.push(`TEMP_OVERRIDE の地点 ${override} が共通地点に存在しない`)
    return result
  }
  result.tempStation = pick.area.code
  result.tempStationName = pick.area.name
  result.tempCandidates = common.map((a) => `${a.area.name}(${a.area.code})`)

  // 欠損値の実態を記録(エラーではなく情報)
  const wk = weeklyTemp.areas.find((a) => a.area.code === pick.area.code)
  result.missing = `短期temps欠損${countMissing(pick.temps)}/${pick.temps.length} 週間tempsMax欠損${countMissing(wk?.tempsMax)}/${wk?.tempsMax?.length ?? 0}`

  return result
}

const area = await fetchJson(AREA_JSON_URL)
const offices = Object.entries(area.offices)
console.log(`offices: ${offices.length} 件を検証します`)

const cache = new Map()
const results = []
for (const [code, info] of offices) {
  const r = await validateOffice(code, info.name, cache)
  results.push(r)
  const mark = r.flags.length ? 'NG ' : r.notes.length ? 'NOTE' : 'OK '
  console.log(`${mark} ${r.code} ${r.name} → 短期:${r.weatherAreaName ?? '-'} 週間:${r.weeklyAreaName ?? '-'} 気温:${r.tempStationName ?? '-'}${r.flags.length ? ' ← ' + r.flags.join(' / ') : ''}${r.notes.length ? ' ← ' + r.notes.join(' / ') : ''}`)
  await sleep(DELAY_MS)
}

// --- areas.ts 生成 ---
const ok = results.filter((r) => r.flags.length === 0)
const ng = results.filter((r) => r.flags.length > 0)

const line = (r) => {
  const alias = r.fetchCode !== r.code ? `, forecastCode: '${r.fetchCode}'` : ''
  return `  { code: '${r.code}', name: '${r.name}', weatherArea: '${r.weatherArea}', weeklyArea: '${r.weeklyArea}', tempStation: '${r.tempStation}'${alias} }, // ${r.weatherAreaName} / 週間:${r.weeklyAreaName} / ${r.tempStationName}`
}

const areasTs = `// 気象庁 府県予報区マスタ
// validate-areas.mjs により ${new Date().toISOString().slice(0, 10)} に全 ${offices.length} 区分の実レスポンスから生成・検証済み。
//
// code:         府県予報区コード(user.areaCode・地域セレクタの値)
// forecastCode: 予報 JSON の取得コード(奄美・十勝のみ親区分に同居するため code と異なる。省略時は code)
// weatherArea:  短期予報の天気・降水確率を引く一次細分区域コード
// weeklyArea:   週間予報の天気・降水確率を引く区域コード(週間は広域統合されるため weatherArea と別)
// tempStation:  気温を引く代表アメダス地点コード(短期・週間の両方に存在することを検証済み)

export const areas = [
${ok.map(line).join('\n')}
] as const

export type Area = (typeof areas)[number]
export type AreaCode = Area['code']
${ng.length ? `\n// ⚠ 未解決の区分:\n${ng.map((r) => `// ${r.code} ${r.name}: ${r.flags.join(' / ')}`).join('\n')}\n` : ''}`

writeFileSync(join(OUT_DIR, 'areas.ts'), areasTs)

// --- レポート生成 ---
const noteRows = ok.filter((r) => r.notes.length > 0)
const report = `# 地域マスタ検証レポート(${new Date().toISOString().slice(0, 10)})

- 対象: 気象庁 area.json の offices 全 ${offices.length} 区分
- 結果: **解決 ${ok.length} 件 / 未解決 ${ng.length} 件 / 要目視確認 ${noteRows.length} 件**

## 検証で確定した構造仕様

- 奄美(460040)・十勝(014030)は自分の予報 JSON を持たない(404)。親区分(鹿児島 460100 / 釧路・根室 014100)のレスポンスに短期・週間とも同居しており、\`forecastCode\` で取得先を分離した
- 週間予報の天気・降水確率は大半の区分で広域(府県予報区単位)に統合される。「office コード一致 → 一次細分区域一致 → 先頭区域」の規則で解決した
- 気温は短期(\`temps\`)・週間(\`tempsMax/tempsMin\`)ともアメダス地点単位。両方に存在する地点のみ代表候補とした

## マスタ一覧

| code | 名称 | 短期天気区域 | 週間天気区域 | 代表アメダス地点 | 気温候補(短期∩週間) | 欠損の実態 |
| --- | --- | --- | --- | --- | --- | --- |
${ok.map((r) => `| ${r.code}${r.fetchCode !== r.code ? `(取得:${r.fetchCode})` : ''} | ${r.name} | ${r.weatherAreaName}(${r.weatherArea}) | ${r.weeklyAreaName}(${r.weeklyArea}) | ${r.tempStationName}(${r.tempStation}) | ${(r.tempCandidates ?? []).join('、')} | ${r.missing ?? ''} |`).join('\n')}

## 要目視確認

${noteRows.length === 0 ? 'なし' : noteRows.map((r) => `- **${r.code} ${r.name}**: ${r.notes.join(' / ')}`).join('\n')}

## 未解決

${ng.length === 0 ? 'なし' : ng.map((r) => `- **${r.code} ${r.name}**: ${r.flags.join(' / ')}`).join('\n')}
`
writeFileSync(join(OUT_DIR, 'validation-report.md'), report)

console.log(`\n解決 ${ok.length} / 未解決 ${ng.length} / 要目視 ${noteRows.length} → areas.ts / validation-report.md を出力しました`)
