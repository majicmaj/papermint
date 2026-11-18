import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';
import { buildProxy } from './proxy.ts';
import { serviceWorker } from './vite-sw.ts';

const proxy = buildProxy(process.env.PAPERMINT_API_TARGET);

export default defineConfig({
  /** PAPERMINT_BASE serves the app under a sub-path, like `/demo/`. The API stays at `/api/`. */
  base: process.env.PAPERMINT_BASE ?? '/',
  plugins: [preact(), serviceWorker()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy,
  },
  preview: { host: '127.0.0.1', port: 4173, proxy },
  build: { target: 'es2022', sourcemap: false, cssCodeSplit: false, assetsInlineLimit: 0 },
  test: {
    include: ['src/**/*.test.ts', '*.test.ts', 'mock-server/**/*.test.mjs'],
    environment: 'node',
  },
});
