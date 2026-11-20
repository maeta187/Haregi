import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createDb } from '@haregi/db'
import { createTestDatabase } from '../../../test/database.ts'
import { createCoordinateRepository } from './repository.ts'

let database: Awaited<ReturnType<typeof createTestDatabase>>
beforeAll(async () => {
  database = await createTestDatabase()
  database.migrate()
  for (const id of ['owner', 'other'])
    await database.pool.query(
      'INSERT INTO "user" (id, name, email, area_code) VALUES ($1,$1,$2,$3)',
      [id, `${id}@example.com`, '130000'],
    )
}, 30_000)
afterAll(async () => {
  await database?.close()
})
beforeEach(async () => {
  await database.pool.query('DELETE FROM coordinate')
  await database.pool.query('DELETE FROM coordinate_version')
})
const item = { date: '2026-11-13', tops: 'シャツ' }
const repo = () => createCoordinateRepository(database.db)
it('新規を version=1 で保存し、自分の日付降順の一覧だけを返す', async () => {
  const repository = repo()
  const saved = await repository.upsertForUser('owner', [item])
  expect(saved.isOk() && saved.value[0]).toMatchObject({
    ...item,
    version: 1,
    snapshotStatus: 'unavailable',
  })
  await repository.upsertForUser('other', [{ ...item, tops: '他人' }])
  const listed = await repository.listByUser('owner')
  expect(listed.isOk() && listed.value).toHaveLength(1)
  expect(listed.isOk() && listed.value[0]?.tops).toBe('シャツ')
})
it('一致した更新ごとに版を進め、旧版・省略・存在しない行の更新を競合にする', async () => {
  const repository = repo()
  await repository.upsertForUser('owner', [item])
  for (const version of [undefined, 2]) {
    const result = await repository.upsertForUser('owner', [
      { ...item, version },
    ])
    expect(result.isErr() && result.error.kind).toBe('VersionConflict')
  }
  for (const version of [1, 2]) {
    const result = await repository.upsertForUser('owner', [
      { ...item, version },
    ])
    expect(result.isOk() && result.value[0]?.version).toBe(version + 1)
  }
  for (const version of [1, 2])
    expect(
      (await repository.upsertForUser('owner', [{ ...item, version }])).isErr(),
    ).toBe(true)
  expect(
    (
      await repository.upsertForUser('owner', [
        { ...item, date: '2026-11-14', version: 1 },
      ])
    ).isErr(),
  ).toBe(true)
})
it('並行保存の後着が競合し、そのリクエストの別の日の保存もロールバックする', async () => {
  const repository = repo()
  await repository.upsertForUser('owner', [item])
  const results = await Promise.all(
    [1, 2].map((n) =>
      repository.upsertForUser('owner', [
        { ...item, date: `2026-11-${14 + n}` },
        { ...item, tops: String(n), version: 1 },
      ]),
    ),
  )
  expect(results.filter((r) => r.isOk())).toHaveLength(1)
  expect(
    results.filter((r) => r.isErr() && r.error.kind === 'VersionConflict'),
  ).toHaveLength(1)
  const rows = await repository.listByUser('owner')
  expect(rows.isOk() && rows.value).toHaveLength(2)
})
it.each([undefined, 99])(
  '更新の競合(%s)で先行 item も全件戻す',
  async (version) => {
    const repository = repo()
    await repository.upsertForUser('owner', [item])
    expect(
      (
        await repository.upsertForUser('owner', [
          { ...item, date: '2026-11-14' },
          { ...item, version },
        ])
      ).isErr(),
    ).toBe(true)
    const rows = await repository.listByUser('owner')
    expect(rows.isOk() && rows.value).toHaveLength(1)
  },
)
it('途中の一般DBエラーでも全件戻し、DbError として返す', async () => {
  const repository = repo()
  const result = await repository.upsertForUser('owner', [
    item,
    { ...item, date: '不正' },
  ])
  expect(result.isErr() && result.error.kind).toBe('DbError')
  const rows = await repository.listByUser('owner')
  expect(rows.isOk() && rows.value).toEqual([])
})
it('空入力は自分の行がなければ版の有無に関係なく no-op、他人の行も消さない', async () => {
  const repository = repo()
  await repository.upsertForUser('other', [item])
  for (const version of [undefined, 1, 99]) {
    const result = await repository.upsertForUser('owner', [
      { date: item.date, outerwear: '　', version },
    ])
    expect(result.isOk() && result.value).toEqual([])
  }
  const rows = await repository.listByUser('other')
  expect(rows.isOk() && rows.value).toHaveLength(1)
})
it.each([undefined, 99])(
  '空入力の版不一致・省略(%s)では削除せず全件戻す',
  async (version) => {
    const repository = repo()
    await repository.upsertForUser('owner', [
      item,
      { ...item, date: '2026-11-14' },
    ])
    const result = await repository.upsertForUser('owner', [
      { date: '2026-11-14', version: 1 },
      { ...item, date: '2026-11-15' },
      { date: item.date, version },
    ])
    expect(result.isErr() && result.error.kind).toBe('VersionConflict')
    const rows = await repository.listByUser('owner')
    expect(rows.isOk() && rows.value.map((row) => row.date)).toEqual([
      '2026-11-14',
      item.date,
    ])
  },
)
it('版一致の削除と未入力日を含む一括保存が成功する', async () => {
  const repository = repo()
  await repository.upsertForUser('owner', [item])
  const result = await repository.upsertForUser('owner', [
    { date: item.date, version: 1, tops: '\n' },
    { date: '2026-11-14' },
    { date: '2026-11-15', version: 99 },
    { ...item, date: '2026-11-16' },
  ])
  expect(result.isOk() && result.value.map((row) => row.date)).toEqual([
    '2026-11-16',
  ])
  const rows = await repository.listByUser('owner')
  expect(rows.isOk() && rows.value.map((row) => row.date)).toEqual([
    '2026-11-16',
  ])
})
it('一覧は省略時直近30件、範囲指定時は両端を含め日付降順', async () => {
  const repository = repo()
  for (let day = 1; day <= 31; day++)
    await repository.upsertForUser('owner', [
      { ...item, date: `2026-10-${String(day).padStart(2, '0')}` },
    ])
  const recent = await repository.listByUser('owner')
  expect(recent.isOk() && recent.value).toHaveLength(30)
  expect(recent.isOk() && recent.value[0]?.date).toBe('2026-10-31')
  const range = await repository.listByUser('owner', {
    from: '2026-10-01',
    to: '2026-10-31',
  })
  expect(range.isOk() && range.value).toHaveLength(31)
  const subset = await repository.listByUser('owner', {
    from: '2026-10-02',
    to: '2026-10-03',
  })
  expect(subset.isOk() && subset.value.map((row) => row.date)).toEqual([
    '2026-10-03',
    '2026-10-02',
  ])
})
it('接続エラーを list / upsert とも DbError にする', async () => {
  const connection = createDb(database.url)
  const repository = createCoordinateRepository(connection.db)
  await connection.pool.end()
  for (const result of [
    await repository.listByUser('owner'),
    await repository.upsertForUser('owner', [item]),
  ])
    expect(result.isErr() && result.error.kind).toBe('DbError')
})
it('複数回の更新・削除・別インスタンスでの再作成でも版を再利用せず、ユーザー別に初回1を保つ', async () => {
  const repository = repo()
  await repository.upsertForUser('owner', [item])
  await repository.upsertForUser('owner', [{ ...item, version: 1 }])
  await repository.upsertForUser('owner', [{ date: item.date, version: 2 }])
  const recreated = await repo().upsertForUser('owner', [item])
  expect(recreated.isOk() && recreated.value[0]?.version).toBe(3)
  await repository.upsertForUser('owner', [{ date: item.date, version: 3 }])
  const again = await repo().upsertForUser('owner', [item])
  expect(again.isOk() && again.value[0]?.version).toBe(4)
  const other = await repository.upsertForUser('other', [item])
  expect(other.isOk() && other.value[0]?.version).toBe(1)
})
it('削除後の並行新規保存でも1件だけが次の版を取得する', async () => {
  const repository = repo()
  await repository.upsertForUser('owner', [item])
  await repository.upsertForUser('owner', [{ date: item.date, version: 1 }])
  const results = await Promise.all([
    repo().upsertForUser('owner', [item]),
    repo().upsertForUser('owner', [item]),
  ])
  expect(results.filter((r) => r.isOk())).toHaveLength(1)
  expect(
    results.filter((r) => r.isErr() && r.error.kind === 'VersionConflict'),
  ).toHaveLength(1)
  const rows = await repository.listByUser('owner')
  expect(rows.isOk() && rows.value[0]?.version).toBe(2)
})
it('競合したバッチでは版の発行もロールバックし、逆順バッチもデッドロックしない', async () => {
  const repository = repo()
  const second = { ...item, date: '2026-11-14' }
  const [first] = await Promise.all([
    repository.upsertForUser('owner', [item, second]),
  ])
  expect(first.isOk()).toBe(true)
  const results = await Promise.all([
    repository.upsertForUser('owner', [
      { ...item, version: 1 },
      { ...second, version: 1 },
    ]),
    repo().upsertForUser('owner', [
      { ...second, version: 1 },
      { ...item, version: 1 },
    ]),
  ])
  expect(results.filter((r) => r.isOk())).toHaveLength(1)
  expect(
    results.filter((r) => r.isErr() && r.error.kind === 'VersionConflict'),
  ).toHaveLength(1)
  await repository.upsertForUser('owner', [
    { date: item.date, version: 2 },
    { date: second.date, version: 2 },
  ])
  const recreated = await repository.upsertForUser('owner', [item, second])
  expect(recreated.isOk() && recreated.value.map((row) => row.version)).toEqual(
    [3, 3],
  )
})
