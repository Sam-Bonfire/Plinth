/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@plinth/ui-kit': path.resolve(__dirname, '../../packages/ui-kit/src'),
      '@plinth/sync-protocol': path.resolve(__dirname, '../../packages/sync-protocol/src'),
      '@plinth/core-domain': path.resolve(__dirname, '../../packages/core-domain/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 1420,
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
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    globals: true,
    setupFiles: [path.resolve(__dirname, '../../setupTests.ts')],
  },
});
