import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import { coordinate, forecastSnapshot, user } from '@haregi/db'

const columnsOf = (table: Parameters<typeof getTableConfig>[0]) =>
  new Map(getTableConfig(table).columns.map((column) => [column.name, column]))

describe('user テーブル', () => {
  it('気象庁の府県予報区コードを必須カラムとして持つ', () => {
    const areaCode = columnsOf(user).get('area_code')

    expect(areaCode?.columnType).toBe('PgText')
    expect(areaCode?.notNull).toBe(true)
  })
})

describe('coordinate テーブル', () => {
  it('ユーザー×日付で一意にする', () => {
    const { uniqueConstraints } = getTableConfig(coordinate)

    expect(uniqueConstraints).toHaveLength(1)
    expect(uniqueConstraints[0]?.columns.map((column) => column.name)).toEqual([
      'user_id',
      'date',
    ])
  })

  it('日付を JST の YYYY-MM-DD 文字列として扱う', () => {
    const date = columnsOf(coordinate).get('date')

    expect(date?.columnType).toBe('PgDateString')
    expect(date?.notNull).toBe(true)
  })

  it('楽観ロックのトークンを 1 始まりの必須整数として持つ', () => {
    const version = columnsOf(coordinate).get('version')

    expect(version?.columnType).toBe('PgInteger')
    expect(version?.notNull).toBe(true)
    expect(version?.default).toBe(1)
  })

  it('気温スナップショットを欠損可能な実数として持つ', () => {
    const columns = columnsOf(coordinate)

    for (const name of ['max_temperature', 'min_temperature']) {
      expect(columns.get(name)?.columnType).toBe('PgReal')
      expect(columns.get(name)?.notNull).toBe(false)
    }
  })

  it('気温スナップショットの由来を欠損可能なカラムとして持つ', () => {
    const columns = columnsOf(coordinate)

    for (const name of [
      'area_code',
      'temp_station',
      'forecast_issued_at',
      'snapshot_status',
    ]) {
      expect(columns.get(name)?.notNull).toBe(false)
    }
  })

  it('ユーザー削除に追随してコーデを削除する', () => {
    const { foreignKeys } = getTableConfig(coordinate)

    expect(foreignKeys).toHaveLength(1)
    expect(foreignKeys[0]?.onDelete).toBe('cascade')
    expect(foreignKeys[0]?.reference().foreignTable).toBe(user)
  })
})

describe('forecast_snapshot テーブル', () => {
  it('予報世代 ID を主キーにする', () => {
    const snapshotId = columnsOf(forecastSnapshot).get('snapshot_id')

    expect(snapshotId?.primary).toBe(true)
  })

  it('正規化済みの予報を必須の jsonb として持つ', () => {
    const payload = columnsOf(forecastSnapshot).get('payload')

    expect(payload?.columnType).toBe('PgJsonb')
    expect(payload?.notNull).toBe(true)
  })

  it('発行時刻・取得時刻・鮮度を必須カラムとして持つ', () => {
    const columns = columnsOf(forecastSnapshot)

    for (const name of [
      'area_code',
      'forecast_issued_at',
      'fetched_at',
      'status',
      'created_at',
    ]) {
      expect(columns.get(name)?.notNull).toBe(true)
    }
  })
})
