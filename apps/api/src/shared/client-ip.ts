import { isIP } from 'node:net'
import { createMiddleware } from 'hono/factory'

/**
 * 入口で確定したクライアント IP を載せる内部ヘッダー。
 *
 * Better Auth のレート制限はこのヘッダーだけを読む(`create-auth.ts`)。
 * `x-forwarded-for` を直接読ませると、クライアントの自己申告で bucket を
 * 分けられ、総当たり対策が迂回できてしまうため。
 */
export const CLIENT_IP_HEADER = 'x-haregi-client-ip'

/** 入口で信用しない(転送元が信頼できる場合のみ意味を持つ)ヘッダー。 */
const UNTRUSTED_FORWARD_HEADERS = ['x-forwarded-for', 'x-real-ip']

export type ClientIpEnv = { Variables: { clientIp: string | null } }

type Network = { bytes: Uint8Array; prefix: number }

/** IP を検証しつつ正規化する。IPv4 射影 IPv6(`::ffff:a.b.c.d`)は IPv4 に戻す。 */
export function normalizeIp(value: string): string | null {
  const address = (value.trim().split('%')[0] ?? '')
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .toLowerCase()
  const version = isIP(address)
  if (version === 4) return address
  if (version !== 6) return null
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address)
  if (mapped?.[1] && isIP(mapped[1]) === 4) return mapped[1]
  return address
}

function toBytes(address: string): Uint8Array | null {
  const version = isIP(address)
  if (version === 4)
    return Uint8Array.from(address.split('.').map((octet) => Number(octet)))
  if (version !== 6) return null
  const [head = '', tail = ''] = address.includes('::')
    ? address.split('::')
    : [address, '']
  const groups = (part: string) => (part ? part.split(':') : [])
  const expand = (list: string[]): string[] =>
    list.flatMap((group) => {
      if (!group.includes('.')) return [group]
      const octets = group.split('.').map((octet) => Number(octet))
      return [
        ((octets[0] ?? 0) * 256 + (octets[1] ?? 0)).toString(16),
        ((octets[2] ?? 0) * 256 + (octets[3] ?? 0)).toString(16),
      ]
    })
  const left = expand(groups(head))
  const right = expand(groups(tail))
  const filled = address.includes('::')
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    : left
  if (filled.length !== 8) return null
  const bytes = new Uint8Array(16)
  filled.forEach((group, index) => {
    const value = Number.parseInt(group, 16)
    bytes[index * 2] = (value >> 8) & 0xff
    bytes[index * 2 + 1] = value & 0xff
  })
  return bytes
}

function parseNetwork(entry: string): Network | null {
  const slash = entry.lastIndexOf('/')
  const address = normalizeIp(slash === -1 ? entry : entry.slice(0, slash))
  const bytes = address ? toBytes(address) : null
  if (!bytes) return null
  const maxBits = bytes.length * 8
  if (slash === -1) return { bytes, prefix: maxBits }
  const suffix = entry.slice(slash + 1)
  if (!/^\d+$/.test(suffix)) return null
  const prefix = Number(suffix)
  return prefix <= maxBits ? { bytes, prefix } : null
}

function matches(address: string, network: Network): boolean {
  const bytes = toBytes(address)
  if (!bytes || bytes.length !== network.bytes.length) return false
  let remaining = network.prefix
  for (let index = 0; index < bytes.length && remaining > 0; index += 1) {
    const take = remaining >= 8 ? 8 : remaining
    const mask = take === 8 ? 0xff : (0xff << (8 - take)) & 0xff
    if (((bytes[index] ?? 0) & mask) !== ((network.bytes[index] ?? 0) & mask))
      return false
    remaining -= 8
  }
  return true
}

/**
 * `TRUSTED_PROXY_IPS`(カンマ区切りの IP / CIDR)を読む。
 * 不正な値は黙って無視せず起動時に落とす(信頼範囲が意図とずれるため)。
 */
export function parseTrustedProxies(value: string | undefined): string[] {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const invalid = entries.filter((entry) => parseNetwork(entry) === null)
  if (invalid.length > 0)
    throw new Error(
      `TRUSTED_PROXY_IPS が不正です(IP または CIDR で指定してください): ${invalid.join(', ')}`,
    )
  return entries
}

/**
 * 信頼できるクライアント IP を決める。
 *
 * 基準は TCP の接続元(詐称できない)で、`x-forwarded-for` は接続元が
 * 信頼できるプロキシのときだけ、右から最初の非プロキシまで遡って採用する。
 * 連鎖が壊れている場合は接続元へ落とす(申告値を信じない)。
 */
export function resolveClientIp(options: {
  peerAddress?: string | null | undefined
  forwardedFor?: string | null | undefined
  trustedProxies?: readonly string[] | undefined
}): string | null {
  const peer = options.peerAddress ? normalizeIp(options.peerAddress) : null
  if (!peer) return null
  const networks = (options.trustedProxies ?? [])
    .map(parseNetwork)
    .filter((network): network is Network => network !== null)
  const trusted = (address: string) =>
    networks.some((network) => matches(address, network))
  if (!trusted(peer)) return peer
  const chain = (options.forwardedFor ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean)
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const hop = normalizeIp(chain[index] ?? '')
    if (!hop) return peer
    if (trusted(hop)) continue
    return hop
  }
  return peer
}

function peerAddress(env: unknown): string | undefined {
  const bindings = env as
    | { server?: { incoming?: { socket?: { remoteAddress?: string } } } }
    | { incoming?: { socket?: { remoteAddress?: string } } }
    | undefined
  const source =
    bindings && 'server' in bindings && bindings.server
      ? bindings.server
      : (bindings as { incoming?: { socket?: { remoteAddress?: string } } })
  return source?.incoming?.socket?.remoteAddress
}

/** 入口で信頼境界を確定し、以降はコンテキストの値だけを使えるようにする。 */
export const clientIp = (trustedProxies: readonly string[]) =>
  createMiddleware<ClientIpEnv>(async (c, next) => {
    c.set(
      'clientIp',
      resolveClientIp({
        peerAddress: peerAddress(c.env),
        forwardedFor: c.req.header('x-forwarded-for'),
        trustedProxies,
      }),
    )
    await next()
  })

/**
 * 委譲先へ渡すリクエストから申告ヘッダーを落とし、確定した IP だけを載せる。
 */
export function withClientIp(request: Request, ip: string | null): Request {
  const headers = new Headers(request.headers)
  for (const header of [...UNTRUSTED_FORWARD_HEADERS, CLIENT_IP_HEADER])
    headers.delete(header)
  if (ip) headers.set(CLIENT_IP_HEADER, ip)
  return new Request(request, { headers })
}
