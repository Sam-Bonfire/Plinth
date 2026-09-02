/// <reference types="vitest" />
import { lingui } from '@lingui/vite-plugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } }), lingui()],
  resolve: {
    alias: {
      '@plinth/ui-kit': path.resolve(__dirname, './src'),
    },
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
