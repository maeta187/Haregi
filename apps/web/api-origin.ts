const DEFAULT_API_PORT = '4000';

type ApiEnv = {
  API_ORIGIN?: string | undefined;
  API_PORT?: string | undefined;
};

/**
 * Vite dev proxy の転送先(api のオリジン)を決める。
 *
 * api 側は `API_PORT` を見て待受ポートを決めるため(`apps/api/src/port.ts`)、
 * web 側も同じ環境変数から転送先を組み立てて両者がずれないようにする。
 * `API_ORIGIN` はリバースプロキシ等で localhost 以外を指したい場合の上書き。
 */
export function resolveApiOrigin(env: ApiEnv): string {
  if (env.API_ORIGIN) {
    return assertValidUrl(env.API_ORIGIN, 'API_ORIGIN');
  }

  const port = env.API_PORT || DEFAULT_API_PORT;
  return assertValidUrl(`http://localhost:${port}`, 'API_PORT');
}

function assertValidUrl(value: string, source: string): string {
  if (!URL.canParse(value)) {
    throw new Error(`${source} が不正です: ${value}`);
  }

  return value;
}
