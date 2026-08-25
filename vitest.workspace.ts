import { defineWorkspace } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const commonTestConfig = {
  environment: 'happy-dom' as const,
  environmentOptions: {
    happyDOM: {
      settings: {
        disableJavaScriptFileLoading: true,
        disableCSSFileLoading: true,
        handleDisabledFileLoadingAsSuccess: true,
      },
    },
  },
  setupFiles: [path.resolve(__dirname, './setupTests.ts')],
  globals: true,
};

export default defineWorkspace([
  {
    plugins: [react()],
    test: {
      name: 'ui-kit',
      root: './packages/ui-kit',
      ...commonTestConfig,
    },
    resolve: {
      alias: {
        '@plinth/ui-kit': path.resolve(__dirname, './packages/ui-kit/src'),
      },
    },
  },
  {
    plugins: [react()],
    test: {
      name: 'pos-client',
      root: './apps/pos-client',
      ...commonTestConfig,
    },
    resolve: {
      alias: {
        '@plinth/ui-kit': path.resolve(__dirname, './packages/ui-kit/src'),
        '@plinth/sync-protocol': path.resolve(__dirname, './packages/sync-protocol/src'),
        '@plinth/core-domain': path.resolve(__dirname, './packages/core-domain/src'),
        '@': path.resolve(__dirname, './apps/pos-client/src'),
      },
    },
  },
  {
    plugins: [react()],
    test: {
      name: 'web-dashboard',
      root: './apps/web-dashboard',
      ...commonTestConfig,
    },
    resolve: {
      alias: {
        '@plinth/ui-kit': path.resolve(__dirname, './packages/ui-kit/src'),
        '@': path.resolve(__dirname, './apps/web-dashboard/src'),
      },
    },
  },
  {
    plugins: [react()],
    test: {
      name: 'marketing-site',
      root: './apps/marketing-site',
      ...commonTestConfig,
    },
    resolve: {
      alias: {
        '@plinth/ui-kit': path.resolve(__dirname, './packages/ui-kit/src'),
        '@': path.resolve(__dirname, './apps/marketing-site/src'),
      },
    },
  },
]);
