import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

import { resolveApiOrigin } from './api-origin.ts'

// api の待受ポート(API_PORT)と転送先を同じ環境変数から導き、両者がずれないようにする
const API_ORIGIN = resolveApiOrigin(process.env)

export default defineConfig({
  resolve: {
    alias: {
      // shadcn/ui の取り込み先(src/components/ui)を含む src 配下のエイリアス
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    // /api/* を api へ転送し、同一オリジンにして CORS / Cookie の問題を避ける
    // (architecture.md「通信経路」)。本番は Nitro のサーバールートまたは前段のプロキシで転送する
    proxy: {
      '/api': {
        target: API_ORIGIN,
        changeOrigin: true,
        // 実クライアント IP を X-Forwarded-For に積む。api 側はこの proxy を
        // TRUSTED_PROXY_IPS に入れて初めて採用する(入口の信頼境界)
        xfwd: true,
      },
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // react の vite プラグインは start のプラグインより後に置く
    viteReact(),
  ],
})
