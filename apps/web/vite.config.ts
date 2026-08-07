import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { resolveApiOrigin } from './api-origin.ts';

// api の待受ポート(API_PORT)と転送先を同じ環境変数から導き、両者がずれないようにする
const API_ORIGIN = resolveApiOrigin(process.env);

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
    // /api/* を api へ転送し、同一オリジンにして CORS / Cookie の問題を避ける
    // (architecture.md「通信経路」)。本番は Nitro のサーバールートまたは前段のプロキシで転送する
    proxy: {
      '/api': {
        target: API_ORIGIN,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tanstackStart(),
    // react の vite プラグインは start のプラグインより後に置く
    viteReact(),
  ],
});
