/// <reference types="vitest" />
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@plinth/ui-kit': resolve(__dirname, '../../packages/ui-kit/src'),
      '@plinth/sync-protocol': resolve(__dirname, '../../packages/sync-protocol/src'),
      '@plinth/core-domain': resolve(__dirname, '../../packages/core-domain/src'),
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
  },
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: {
        settings: {
          disableJavaScriptFileLoading: true,
          disableCSSFileLoading: true,
        },
      },
    },
    globals: true,
    setupFiles: [resolve(__dirname, '../../setupTests.ts')],
  },
});
