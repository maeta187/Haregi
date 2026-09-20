import { expect, it } from 'vitest'
import { getCurrentUser } from './get-current-user.ts'

it('セッションがない場合は null を返す', async () => {
  await expect(
    getCurrentUser({ getSession: async () => null }, new Headers()),
  ).resolves.toBeNull()
})

it('要求の Cookie でセッションを解決し、AuthUser のみを返す', async () => {
  const user = {
    id: 'user-1',
    name: '晴れ',
    email: 'user@example.com',
    areaCode: '130000',
  }
  const sessionReader = {
    getSession: async ({ headers }: { headers: Headers }) =>
      headers.get('cookie') === 'session=valid' ? { user } : null,
  }
  await expect(
    getCurrentUser(sessionReader, new Headers({ cookie: 'session=valid' })),
  ).resolves.toEqual(user)
})
