const DEFAULT_API_PORT = 4000;

/**
 * API の待受ポートを決める。`.env` の読み込みはフェーズ4以降で導入するため、
 * 現時点では process.env から渡された値をそのまま解釈する。
 */
export function resolveApiPort(value: string | undefined): number {
  if (value === undefined || value === '') {
    return DEFAULT_API_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`API_PORT が不正です: ${value}`);
  }

  return port;
}
