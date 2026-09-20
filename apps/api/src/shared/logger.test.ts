import { Writable } from 'node:stream'
import { Hono } from 'hono'
import { expect, it } from 'vitest'

import { createLogger, requestLogger } from './logger.ts'

it('リクエストを構造化し、秘密を含めず requestId を応答とログで共有する', async () => {
  const lines: string[] = []
  const destination = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk))
      done()
    },
  })
  const app = new Hono()
    .use(requestLogger(createLogger('info', destination)))
    .post('/example', (c) => c.json({ ok: true }, 201))
  const response = await app.request('/example?token=secret', {
    method: 'POST',
    headers: { authorization: 'secret' },
    body: 'password123',
  })
  expect(response.headers.get('x-request-id')).toBeTruthy()
  expect(JSON.parse(lines[0]!)).toMatchObject({
    method: 'POST',
    path: '/example',
    status: 201,
    duration: expect.any(Number),
    requestId: response.headers.get('x-request-id'),
  })
  expect(lines.join('')).not.toMatch(/secret|password123/)
})
