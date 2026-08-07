import { describe, expect, it } from 'vitest';

import { app } from './app.ts';

describe('GET /api/health', () => {
  it('200 と {status: "ok"} を返す', async () => {
    const res = await app.request('/api/health');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok' });
  });
});
