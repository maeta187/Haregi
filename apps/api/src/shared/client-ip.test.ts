import { describe, expect, it } from 'vitest'
import {
  CLIENT_IP_HEADER,
  normalizeIp,
  parseTrustedProxies,
  resolveClientIp,
  withClientIp,
} from './client-ip.ts'

describe('resolveClientIp', () => {
  it('信頼できるプロキシの指定がなければ、申告ヘッダーを無視して接続元を使う', () => {
    expect(
      resolveClientIp({
        peerAddress: '203.0.113.7',
        forwardedFor: '192.0.2.100',
      }),
    ).toBe('203.0.113.7')
  })

  it('接続元が信頼できるプロキシなら、右から最初の非プロキシを採用する', () => {
    expect(
      resolveClientIp({
        peerAddress: '127.0.0.1',
        // 左側はクライアントが仕込める。右端がプロキシの付けた実接続元
        forwardedFor: '192.0.2.100, 198.51.100.9',
        trustedProxies: ['127.0.0.1'],
      }),
    ).toBe('198.51.100.9')
  })

  it('連鎖の途中までがプロキシなら、その手前のホップを採用する', () => {
    expect(
      resolveClientIp({
        peerAddress: '10.0.0.5',
        forwardedFor: '198.51.100.9, 10.0.0.8',
        trustedProxies: ['10.0.0.0/8'],
      }),
    ).toBe('198.51.100.9')
  })

  it('連鎖が壊れていれば申告値を信じず接続元へ落とす', () => {
    for (const forwardedFor of ['not-an-ip', '198.51.100.9, not-an-ip', ''])
      expect(
        resolveClientIp({
          peerAddress: '127.0.0.1',
          forwardedFor,
          trustedProxies: ['127.0.0.1'],
        }),
      ).toBe('127.0.0.1')
  })

  it('全ホップがプロキシなら接続元へ落とす', () => {
    expect(
      resolveClientIp({
        peerAddress: '127.0.0.1',
        forwardedFor: '127.0.0.2, 127.0.0.3',
        trustedProxies: ['127.0.0.0/8'],
      }),
    ).toBe('127.0.0.1')
  })

  it('IPv6 の接続元と IPv4 射影を正規化する', () => {
    expect(resolveClientIp({ peerAddress: '::ffff:203.0.113.7' })).toBe(
      '203.0.113.7',
    )
    expect(resolveClientIp({ peerAddress: '[2001:DB8::1]%eth0' })).toBe(
      '2001:db8::1',
    )
    expect(
      resolveClientIp({
        peerAddress: '2001:db8::1',
        forwardedFor: '198.51.100.9',
        trustedProxies: ['2001:db8::/32'],
      }),
    ).toBe('198.51.100.9')
  })

  it('接続元が取れなければ null(共有 bucket)にする', () => {
    expect(resolveClientIp({ peerAddress: undefined })).toBeNull()
    expect(resolveClientIp({ peerAddress: 'unknown' })).toBeNull()
  })

  it('normalizeIp は不正値を弾く', () => {
    expect(normalizeIp('192.0.2.1')).toBe('192.0.2.1')
    expect(normalizeIp('192.0.2.1.5')).toBeNull()
    expect(normalizeIp(' ')).toBeNull()
  })
})

describe('parseTrustedProxies', () => {
  it('カンマ区切りを読み、未設定は空にする', () => {
    expect(parseTrustedProxies(' 127.0.0.1, 10.0.0.0/8 ')).toEqual([
      '127.0.0.1',
      '10.0.0.0/8',
    ])
    expect(parseTrustedProxies(undefined)).toEqual([])
  })

  it('不正な値は無視せず落とす', () => {
    for (const value of ['10.0.0.0/64', 'proxy.example.com', '10.0.0.0/x'])
      expect(() => parseTrustedProxies(value)).toThrow(/TRUSTED_PROXY_IPS/)
  })
})

describe('withClientIp', () => {
  it('申告ヘッダーを落とし、確定した IP だけを載せる', async () => {
    const request = withClientIp(
      new Request('http://localhost/api/auth/sign-in/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.0.2.100',
          'x-real-ip': '192.0.2.100',
          [CLIENT_IP_HEADER]: '192.0.2.100',
        },
        body: '{"email":"a@example.com"}',
      }),
      '203.0.113.7',
    )
    expect(request.headers.get('x-forwarded-for')).toBeNull()
    expect(request.headers.get('x-real-ip')).toBeNull()
    expect(request.headers.get(CLIENT_IP_HEADER)).toBe('203.0.113.7')
    await expect(request.text()).resolves.toBe('{"email":"a@example.com"}')
  })

  it('IP を決められなければ内部ヘッダーを付けない', () => {
    expect(
      withClientIp(
        new Request('http://localhost/api/auth/get-session', {
          headers: { [CLIENT_IP_HEADER]: '192.0.2.100' },
        }),
        null,
      ).headers.get(CLIENT_IP_HEADER),
    ).toBeNull()
  })
})
