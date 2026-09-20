import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { expect, it } from 'vitest'

it('Node エントリで起動して health に応答し、SIGTERM で正常終了する', async () => {
  const reservation = createServer().listen(0, '127.0.0.1')
  await once(reservation, 'listening')
  const address = reservation.address()
  if (!address || typeof address === 'string')
    throw new Error('ポートを取得できませんでした')
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  )
  const child = spawn(process.execPath, ['src/index.ts'], {
    env: {
      ...process.env,
      TZ: 'UTC',
      API_PORT: String(address.port),
      LOG_LEVEL: 'info',
    },
    stdio: 'pipe',
  })
  const exited = once(child, 'exit')
  try {
    await Promise.race([
      once(child.stdout, 'data'),
      exited.then(() => {
        throw new Error('起動前にプロセスが終了しました')
      }),
    ])
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    child.kill('SIGTERM')
    expect(await exited).toEqual([0, null])
  } finally {
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL')
  }
}, 15_000)
