const DEFAULT_API_PORT = 4000

/**
 * API の待受ポートを決める。環境変数は起動スクリプトで .env を読み込んでから渡す。
 */
export function resolveApiPort(value: string | undefined): number {
  if (value === undefined || value === '') {
    return DEFAULT_API_PORT
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`API_PORT が不正です: ${value}`)
  }

  return port
}
