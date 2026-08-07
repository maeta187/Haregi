import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// コンポーネントテスト用の設定。vite.config.ts の TanStack Start プラグインは
// ルート生成・SSR 用のため、テストでは読み込まない。
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
