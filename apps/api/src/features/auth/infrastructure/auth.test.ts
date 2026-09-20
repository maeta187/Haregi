import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase } from '../../../test/database.ts'
import { createAuth } from './create-auth.ts'

describe('Better Auth の会員登録', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>
  let auth: ReturnType<typeof createAuth>
  let client = 0
  beforeAll(async () => {
    database = await createTestDatabase()
    database.migrate()
    auth = createAuth(database.db, {
      baseURL: 'http://localhost:3000',
      secret: 'test-secret-with-at-least-32-characters',
      webOrigin: 'http://localhost:3000',
    })
  }, 30_000)
  afterAll(async () => {
    await database?.close()
  })

  async function registerSession(email: string) {
    const response = await auth.api.signUpEmail({
      body: {
        name: '晴れ',
        email,
        password: 'password123',
        areaCode: '130000',
      },
      asResponse: true,
    })
    return new Headers({
      cookie: response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; '),
    })
  }

  it('登録名を trim して保存し、メール・パスワードでログインできる', async () => {
    const signup = await auth.api.signUpEmail({
      body: {
        name: ' 晴れ ☀ ',
        email: 'auth@example.com',
        password: 'password123',
        areaCode: '130000',
      },
    })
    expect(signup.user).toMatchObject({ name: '晴れ ☀', areaCode: '130000' })
    const login = await auth.api.signInEmail({
      body: { email: 'auth@example.com', password: 'password123' },
    })
    expect(login.user.id).toBe(signup.user.id)
    expect(login.token).toBeTruthy()
  })

  it.each([
    { name: ' ' },
    { name: 'あ'.repeat(21) },
    { areaCode: '999999' },
    { password: 'abcdefgh' },
    { password: '12345678' },
  ])('HTTP の登録経路で不正入力 %j を 400 にする', async (invalid) => {
    const response = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'x-forwarded-for': `192.0.2.${++client}`,
        },
        body: JSON.stringify({
          name: '晴れ',
          email: 'invalid@example.com',
          password: 'password123',
          areaCode: '130000',
          ...invalid,
        }),
      }),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.any(String),
    })
  })

  it.each([
    ['abc1234', 'PASSWORD_TOO_SHORT'],
    ['a1'.repeat(11), 'PASSWORD_TOO_LONG'],
  ])(
    'Better Auth が登録パスワードの長さを %s → %s と検証する',
    async (password, code) => {
      await expect(
        auth.api.signUpEmail({
          body: {
            name: '晴れ',
            email: 'length@example.com',
            areaCode: '130000',
            password,
          },
        }),
      ).rejects.toMatchObject({ statusCode: 400, body: { code } })
    },
  )

  it('ログイン後のユーザー更新も検証し、正しい値だけを trim して保存する', async () => {
    const headers = await registerSession('update@example.com')
    for (const body of [
      { name: ' ' },
      { name: 'あ'.repeat(21) },
      { areaCode: '999999' },
    ]) {
      await expect(
        auth.api.updateUser({ headers, body }),
      ).rejects.toMatchObject({ statusCode: 400 })
    }
    await auth.api.updateUser({
      headers,
      body: { name: ' 更新後 ', areaCode: '270000' },
    })
    expect((await auth.api.getSession({ headers }))?.user).toMatchObject({
      name: '更新後',
      areaCode: '270000',
    })
  })

  it('パスワード変更でも文字種・長さを検証し、正しい変更後は再ログインできる', async () => {
    const headers = await registerSession('password-change@example.com')
    for (const newPassword of [
      'abcdefgh',
      '12345678',
      'abc1234',
      'a1'.repeat(11),
    ]) {
      await expect(
        auth.api.changePassword({
          headers,
          body: { currentPassword: 'password123', newPassword },
        }),
      ).rejects.toMatchObject({ statusCode: 400 })
    }
    await auth.api.changePassword({
      headers,
      body: { currentPassword: 'password123', newPassword: 'changed123' },
    })
    expect(
      (
        await auth.api.signInEmail({
          body: {
            email: 'password-change@example.com',
            password: 'changed123',
          },
        })
      ).user.email,
    ).toBe('password-change@example.com')
  })
})
