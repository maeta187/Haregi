import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authClient } from '@/lib/auth-client.ts'
import { fetchSession, signIn, signOut, signUp } from './auth-api.ts'

const { transport } = vi.hoisted(() => ({ transport: vi.fn<typeof fetch>() }))

// SDK のストアと認証処理を通し、通信の境界だけを置き換える。
vi.mock('@/lib/auth-client.ts', async () => {
  const { createAuthClient } = await import('better-auth/react')
  return {
    authClient: createAuthClient({
      baseURL: 'http://localhost:3000',
      fetchOptions: { customFetchImpl: transport },
    }),
  }
})

const session = {
  session: {
    id: 'session-1',
    token: 'token-1',
    userId: 'user-1',
    expiresAt: new Date(Date.now() + 3_600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: {
    id: 'user-1',
    name: 'テスト',
    email: 'test@example.com',
    emailVerified: false,
    areaCode: '130000',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

function pendingResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(async () => {
  // signOut が予約する signal の10ms前に旧応答が届く順序を固定する。
  // refetch 自体は実 SDK の処理を実行する。
  vi.useFakeTimers()
  transport.mockReset()
  const store = authClient.$store.atoms.session!
  store.set({ ...store.get(), data: session, error: null, isPending: false })
  transport.mockImplementation(async () => json(session))
  await fetchSession()
  transport.mockReset()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

it.each([null, 401])(
  'SDK が同じセッションの期限を更新しても後発ガードの未認証(%s)を受け入れる',
  async (unauthorized) => {
    const sdkResponse = pendingResponse()
    const guardResponse = pendingResponse()
    const sdkStarted = Promise.withResolvers<void>()
    const guardStarted = Promise.withResolvers<void>()
    transport
      .mockImplementationOnce(() => {
        sdkStarted.resolve()
        return sdkResponse.promise
      })
      .mockImplementationOnce(() => {
        guardStarted.resolve()
        return guardResponse.promise
      })
      .mockImplementation(async () => json(null, 503))
    const background = authClient.$store.atoms.session!.get().refetch()
    await sdkStarted.promise
    const guard = fetchSession()
    await guardStarted.promise
    sdkResponse.resolve(
      json({
        ...session,
        session: {
          ...session.session,
          expiresAt: new Date(Date.now() + 7_200_000),
        },
      }),
    )
    await background
    guardResponse.resolve(json(null, unauthorized ?? 200))
    await expect(guard).resolves.toBeNull()
    await expect(fetchSession()).rejects.toThrow(
      'セッションを確認できませんでした',
    )
  },
)

it.each(['ログイン', '会員登録'])(
  '%s 直後に SDK の認証が先に完了してもガードは同じ新ユーザーを返す',
  async (operation) => {
    const response = pendingResponse()
    const started = Promise.withResolvers<void>()
    const nextSession = {
      ...session,
      session: { ...session.session, id: 'session-2', userId: 'user-2' },
      user: { ...session.user, id: 'user-2' },
    }
    transport
      .mockResolvedValueOnce(json({ token: 'token-2', user: nextSession.user }))
      .mockImplementationOnce(() => {
        started.resolve()
        return response.promise
      })
      .mockResolvedValueOnce(json(nextSession))
      .mockImplementation(async () => json(null, 503))
    const values = {
      name: '別ユーザー',
      email: 'next@example.com',
      password: 'password123',
      areaCode: '130000',
    }
    if (operation === 'ログイン') await signIn(values)
    else await signUp(values)
    const guard = fetchSession()
    await started.promise
    await authClient.$store.atoms.session!.get().refetch()
    expect(authClient.$store.atoms.session!.get().data?.user.id).toBe('user-2')
    response.resolve(json(nextSession))
    await expect(guard).resolves.toMatchObject({ user: { id: 'user-2' } })
    await expect(fetchSession()).resolves.toMatchObject({
      user: { id: 'user-2' },
    })
  },
)

it.each([null, 401])(
  '後発の未認証(%s)を古い認証成功が上書きしない',
  async (unauthorized) => {
    const response = pendingResponse()
    const started = Promise.withResolvers<void>()
    transport
      .mockImplementationOnce(() => {
        started.resolve()
        return response.promise
      })
      .mockResolvedValueOnce(json(null, unauthorized ?? 200))
    const older = fetchSession()
    await started.promise
    await expect(fetchSession()).resolves.toBeNull()
    response.resolve(json(session))
    await expect(older).resolves.toBeNull()
    transport.mockResolvedValue(json(null, 503))
    await expect(fetchSession()).rejects.toThrow(
      'セッションを確認できませんでした',
    )
  },
)

it('ログアウト成功後は進行中だった取得も旧セッションを復活させない', async () => {
  const response = pendingResponse()
  const started = Promise.withResolvers<void>()
  transport
    .mockImplementationOnce(() => {
      started.resolve()
      return response.promise
    })
    .mockResolvedValueOnce(json({ success: true }))
  const older = fetchSession()
  await started.promise
  await signOut()
  expect(authClient.$store.atoms.session!.get().data).toBeNull()
  response.resolve(json(session))
  await expect(older).resolves.toBeNull()
  transport.mockImplementation(async () => json(null, 503))
  await expect(fetchSession()).rejects.toThrow(
    'セッションを確認できませんでした',
  )
})

it('SDK 自身の refetch がログアウト後に旧セッションを戻しても障害時に採用しない', async () => {
  const response = pendingResponse()
  const started = Promise.withResolvers<void>()
  transport
    .mockImplementationOnce(() => {
      started.resolve()
      return response.promise
    })
    .mockResolvedValueOnce(json({ success: true }))
    .mockImplementation(async () => json(null, 503))
  const background = authClient.$store.atoms.session!.get().refetch()
  await started.promise
  await signOut()
  expect(authClient.$store.atoms.session!.get().data).toBeNull()
  response.resolve(json(session))
  await background
  // SDK が data を戻すケースそのものを再現できていることを確認する。
  expect(authClient.$store.atoms.session!.get().data?.user.id).toBe('user-1')
  await expect(fetchSession()).rejects.toThrow(
    'セッションを確認できませんでした',
  )
})

it.each([null, 401])(
  'SDK の旧応答が未認証(%s)確認後に戻っても障害時に採用しない',
  async (unauthorized) => {
    const response = pendingResponse()
    const started = Promise.withResolvers<void>()
    transport
      .mockImplementationOnce(() => {
        started.resolve()
        return response.promise
      })
      .mockResolvedValueOnce(json(null, unauthorized ?? 200))
      .mockImplementation(async () => json(null, 503))
    const background = authClient.$store.atoms.session!.get().refetch()
    await started.promise
    await expect(fetchSession()).resolves.toBeNull()
    response.resolve(json(session))
    await background
    expect(authClient.$store.atoms.session!.get().data?.user.id).toBe('user-1')
    await expect(fetchSession()).rejects.toThrow(
      'セッションを確認できませんでした',
    )
  },
)

it('別ユーザー確認後に SDK の旧応答が戻っても障害時に旧ユーザーを採用しない', async () => {
  const response = pendingResponse()
  const started = Promise.withResolvers<void>()
  const nextSession = {
    ...session,
    session: { ...session.session, id: 'session-2', userId: 'user-2' },
    user: { ...session.user, id: 'user-2' },
  }
  transport
    .mockImplementationOnce(() => {
      started.resolve()
      return response.promise
    })
    .mockResolvedValueOnce(json(nextSession))
    .mockImplementation(async () => json(null, 503))
  const background = authClient.$store.atoms.session!.get().refetch()
  await started.promise
  await expect(fetchSession()).resolves.toMatchObject({
    user: { id: 'user-2' },
  })
  response.resolve(json(session))
  await background
  expect(authClient.$store.atoms.session!.get().data?.user.id).toBe('user-1')
  await expect(fetchSession()).rejects.toThrow(
    'セッションを確認できませんでした',
  )
})

it.each(['ログイン', '会員登録'])(
  '%s で別ユーザーになった後、古い取得結果で上書きしない',
  async (operation) => {
    const response = pendingResponse()
    const started = Promise.withResolvers<void>()
    const nextSession = {
      ...session,
      user: { ...session.user, id: 'user-2' },
      session: { ...session.session, id: 'session-2', userId: 'user-2' },
    }
    transport
      .mockImplementationOnce(() => {
        started.resolve()
        return response.promise
      })
      .mockResolvedValueOnce(json({ token: 'token-2', user: nextSession.user }))
      .mockResolvedValueOnce(json(nextSession))
    const older = fetchSession()
    await started.promise
    const values = {
      name: '別ユーザー',
      email: 'next@example.com',
      password: 'password123',
      areaCode: '130000',
    }
    if (operation === 'ログイン') await signIn(values)
    else await signUp(values)
    await expect(fetchSession()).resolves.toMatchObject({
      user: { id: 'user-2' },
    })
    response.resolve(json(session))
    await expect(older).resolves.toMatchObject({ user: { id: 'user-2' } })
    transport.mockImplementation(async () => json(null, 503))
    await expect(fetchSession()).resolves.toMatchObject({
      user: { id: 'user-2' },
    })
  },
)
