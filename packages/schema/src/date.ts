const JST_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1_000
const JST_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const padTwoDigits = (value: number): string => String(value).padStart(2, '0')

export const todayJst = (): string => {
  const nowInJst = new Date(Date.now() + JST_OFFSET_MILLISECONDS)

  return `${nowInJst.getUTCFullYear()}-${padTwoDigits(nowInJst.getUTCMonth() + 1)}-${padTwoDigits(nowInJst.getUTCDate())}`
}

export const isValidJstDate = (date: string): boolean => {
  const match = JST_DATE_PATTERN.exec(date)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

export const formatJstDate = (date: string): string => {
  const match = JST_DATE_PATTERN.exec(date)
  if (!match || !isValidJstDate(date)) {
    throw new RangeError('有効なJST日付を指定してください')
  }

  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`
}

export const shiftJstYear = (date: string, years: number): string => {
  const match = JST_DATE_PATTERN.exec(date)
  if (!match || !isValidJstDate(date)) {
    throw new RangeError('有効なJST日付を指定してください')
  }

  const year = Number(match[1]) + years
  const month = Number(match[2])
  const day = Number(match[3])
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return `${year}-${padTwoDigits(month)}-${padTwoDigits(Math.min(day, lastDay))}`
}

/** 予報の発表時刻(絶対時刻)を、実行環境によらずJSTで表示する。 */
export const formatJstDateTime = (iso: string): string => {
  const jst = new Date(new Date(iso).getTime() + JST_OFFSET_MILLISECONDS)
  return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日 ${jst.getUTCHours()}時${padTwoDigits(jst.getUTCMinutes())}分`
}
