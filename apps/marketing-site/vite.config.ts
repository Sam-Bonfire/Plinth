/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4000,
    strictPort: true,
    host: true,
  },
  resolve: {
    alias: {
      '@plinth/ui-kit': path.resolve(__dirname, '../../packages/ui-kit/src'),
      '@plinth/sync-protocol': path.resolve(__dirname, '../../packages/sync-protocol/src'),
      '@plinth/core-domain': path.resolve(__dirname, '../../packages/core-domain/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: [path.resolve(__dirname, '../../setupTests.ts')],
  },
});
