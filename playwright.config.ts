import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/** Parallel runs set PAPERMINT_PORT and PAPERMINT_OUT, so each has its own server and its own build. */
const PORT = Number(process.env.PAPERMINT_PORT ?? 4173);
const OUT = process.env.PAPERMINT_OUT ?? 'dist';
/** The service worker specs run against a mock server that serves the build and a fake API. */
export const MOCK_PORT = Number(process.env.PAPERMINT_MOCK_PORT ?? 4673);

/** Reuse an installed Chromium when this Playwright's pinned build is missing. Newest first. */
function chromiumPath(): string | undefined {
  if (process.env.PAPERMINT_CHROMIUM) return process.env.PAPERMINT_CHROMIUM;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const app =
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const builds = existsSync(cache)
    ? readdirSync(cache)
        .filter((name) => /^chromium-\d+$/.test(name))
        .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))
    : [];
  return builds.map((name) => join(cache, name, app)).find((path) => existsSync(path));
}

const executablePath = chromiumPath();

export default defineConfig({
  testDir: './e2e',
  outputDir: process.env.PAPERMINT_RESULTS ?? 'test-results',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Specs route requests with page.route, which a service worker would bypass.
    serviceWorkers: 'block',
    // PDF previews need the full browser and its PDF viewer.
    channel: executablePath ? undefined : 'chromium',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /pwa-.*\.spec\.ts/,
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'pwa',
      workers: 1, // These tests share a controllable mock archive.
      testMatch: /pwa-.*\.spec\.ts/,
      use: {
        baseURL: `http://127.0.0.1:${MOCK_PORT}`,
        serviceWorkers: 'allow',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      testIgnore: /pwa-.*\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        defaultBrowserType: 'chromium',
      },
    },
  ],
  webServer: [
    {
      command: `npx vite build --outDir ${OUT} && node mock-server/server.mjs`,
      env: { DIST: OUT, PORT: String(PORT) },
      url: `http://127.0.0.1:${PORT}/__log`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `node mock-server/server.mjs`,
      env: { DIST: OUT, PORT: String(MOCK_PORT) },
      url: `http://127.0.0.1:${MOCK_PORT}/__log`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
