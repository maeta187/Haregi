import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { coordinatesUpsertSchema } from '@haregi/schema'

const validItem = {
  date: '2026-08-19',
  outerwear: 'ジャケット',
  tops: 'シャツ',
  bottoms: 'パンツ',
}

describe('coordinatesUpsertSchema', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T03:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('snapshotIdを省略した入力を受理する', () => {
    expect(
      coordinatesUpsertSchema.safeParse({ items: [validItem] }).success,
    ).toBe(true)
  })

  it('snapshotIdを含む入力を受理する', () => {
    expect(
      coordinatesUpsertSchema.safeParse({
        snapshotId: 'snapshot-1',
        items: [validItem],
      }).success,
    ).toBe(true)
  })

  it('空のitemsを受理する', () => {
    expect(coordinatesUpsertSchema.safeParse({ items: [] }).success).toBe(true)
  })

  it('itemsを最大7件まで受理する', () => {
    const items = Array.from({ length: 7 }, (_, index) => ({
      ...validItem,
      date: `2026-08-${String(index + 19).padStart(2, '0')}`,
    }))

    expect(coordinatesUpsertSchema.safeParse({ items }).success).toBe(true)
  })

  it('itemsが8件以上の入力を拒否する', () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      ...validItem,
      date: `2026-08-${String(index + 18).padStart(2, '0')}`,
    }))

    expect(coordinatesUpsertSchema.safeParse({ items }).success).toBe(false)
  })

  it('同じ日付を複数含む入力を拒否する', () => {
    expect(
      coordinatesUpsertSchema.safeParse({
        items: [validItem, { ...validItem, tops: 'ニット' }],
      }).success,
    ).toBe(false)
  })

  it.each(['2026/08/19', '2026-02-30'])('不正な日付 %s を拒否する', (date) => {
    expect(
      coordinatesUpsertSchema.safeParse({
        items: [{ ...validItem, date }],
      }).success,
    ).toBe(false)
  })

  it.each(['2025-08-19', '2027-08-19'])(
    'JSTの今日から前後1年の境界日 %s を受理する',
    (date) => {
      expect(
        coordinatesUpsertSchema.safeParse({
          items: [{ ...validItem, date }],
        }).success,
      ).toBe(true)
    },
  )

  it.each(['2025-08-18', '2027-08-20'])(
    'JSTの今日から前後1年を超える日 %s を拒否する',
    (date) => {
      expect(
        coordinatesUpsertSchema.safeParse({
          items: [{ ...validItem, date }],
        }).success,
      ).toBe(false)
    },
  )

  it('衣類3項目をtrimして返す', () => {
    const result = coordinatesUpsertSchema.safeParse({
      items: [
        {
          ...validItem,
          outerwear: '  コート  ',
          tops: '  ニット  ',
          bottoms: '  デニム  ',
        },
      ],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0]).toMatchObject({
        outerwear: 'コート',
        tops: 'ニット',
        bottoms: 'デニム',
      })
    }
  })

  it.each(['outerwear', 'tops', 'bottoms'] as const)(
    '%sはtrim後50文字まで受理する',
    (field) => {
      expect(
        coordinatesUpsertSchema.safeParse({
          items: [{ ...validItem, [field]: `  ${'服'.repeat(50)}  ` }],
        }).success,
      ).toBe(true)
    },
  )

  it.each(['outerwear', 'tops', 'bottoms'] as const)(
    '%sはtrim後51文字を拒否する',
    (field) => {
      expect(
        coordinatesUpsertSchema.safeParse({
          items: [{ ...validItem, [field]: '服'.repeat(51) }],
        }).success,
      ).toBe(false)
    },
  )

  it('衣類3項目の省略を受理する', () => {
    expect(
      coordinatesUpsertSchema.safeParse({
        items: [{ date: validItem.date }],
      }).success,
    ).toBe(true)
  })

  it('versionの省略と正の整数を受理する', () => {
    expect(
      coordinatesUpsertSchema.safeParse({ items: [validItem] }).success,
    ).toBe(true)
    expect(
      coordinatesUpsertSchema.safeParse({
        items: [{ ...validItem, version: 1 }],
      }).success,
    ).toBe(true)
  })

  it.each([0, -1, 1.5])('正の整数でないversion %s を拒否する', (version) => {
    expect(
      coordinatesUpsertSchema.safeParse({
        items: [{ ...validItem, version }],
      }).success,
    ).toBe(false)
  })

  it('不正な入力に日本語の利用者向けメッセージを返す', () => {
    const result = coordinatesUpsertSchema.safeParse({
      items: [{ ...validItem, date: '2026-02-30' }],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          /[ぁ-んァ-ヶ一-龠]/.test(issue.message),
        ),
      ).toBe(true)
    }
  })
})
