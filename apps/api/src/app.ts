import { Hono } from 'hono';

/**
 * 各 feature の presentation ルータはフェーズ4以降でここへマウントする。
 * 現時点はヘルスチェックのみを持つ骨格。
 */
export const app = new Hono().get('/api/health', (c) =>
  c.json({ status: 'ok' }),
);

export type AppType = typeof app;
