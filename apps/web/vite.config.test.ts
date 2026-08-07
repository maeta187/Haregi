import { describe, expect, it } from 'vitest';

import config from './vite.config.ts';

describe('vite.config', () => {
  it('/api/* を API サーバー(:4000)へプロキシする', () => {
    const proxy = config.server?.proxy;

    expect(proxy?.['/api']).toMatchObject({
      target: 'http://localhost:4000',
      changeOrigin: true,
    });
  });

  it('web は 3000 番ポートに固定して起動する', () => {
    expect(config.server?.port).toBe(3000);
    expect(config.server?.strictPort).toBe(true);
  });
});
