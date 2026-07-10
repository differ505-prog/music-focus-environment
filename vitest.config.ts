import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // 預設用 node（純函數測試最快）。
    // 需要 DOM 的測試檔案開頭加 `// @vitest-environment jsdom` 覆寫。
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
  },
});