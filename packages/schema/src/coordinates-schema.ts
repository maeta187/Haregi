import { z } from 'zod'

import { isValidJstDate, shiftJstYear, todayJst } from './date.ts'

const coordinateDateSchema = z.string().superRefine((date, context) => {
  if (!isValidJstDate(date)) {
    context.addIssue({
      code: 'custom',
      message: '日付は実在するYYYY-MM-DD形式で入力してください',
    })
    return
  }

  const today = todayJst()
  if (date < shiftJstYear(today, -1) || date > shiftJstYear(today, 1)) {
    context.addIssue({
      code: 'custom',
      message: '日付は今日から前後1年以内で入力してください',
    })
  }
})

const clothingSchema = z
  .string()
  .trim()
  .max(50, 'コーデ項目は50文字以内で入力してください')
  .optional()

const coordinateItemSchema = z.object({
  date: coordinateDateSchema,
  outerwear: clothingSchema,
  tops: clothingSchema,
  bottoms: clothingSchema,
  version: z
    .number()
    .int('versionは整数で入力してください')
    .positive('versionは正の数で入力してください')
    .optional(),
})

export const coordinatesUpsertSchema = z
  .object({
    snapshotId: z.string().optional(),
    items: z
      .array(coordinateItemSchema)
      .max(7, 'コーデは一度に7件まで保存できます'),
  })
  .superRefine(({ items }, context) => {
    const seenDates = new Set<string>()

    items.forEach((item, index) => {
      if (seenDates.has(item.date)) {
        context.addIssue({
          code: 'custom',
          message: '同じ日付を複数指定できません',
          path: ['items', index, 'date'],
        })
      }
      seenDates.add(item.date)
    })
  })
