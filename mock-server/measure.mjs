/**
 * Time to the first record on screen, cold (nothing stored) and warm (worker, cached shell and
 * stored index), on a desktop and on a throttled phone. Needs the mock server running.
 * Usage: BASE=http://127.0.0.1:4773 LATENCY=150 node mock-server/measure.mjs
 */
import { chromium, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4773';
const LATENCY = Number(process.env.LATENCY ?? 150);
const RUNS = Number(process.env.RUNS ?? 5);

const cache = join(homedir(), 'Library/Caches/ms-playwright');
const exe = ['chromium-1200', 'chromium-1255']
  .map((v) =>
    join(
      cache,
      v,
      'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    ),
  )
  .find((p) => existsSync(p));

const PROFILES = {
  desktop: { options: { viewport: { width: 1440, height: 900 } }, cpu: 1, net: null },
  'phone (4x CPU, slow 4G)': {
    options: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    cpu: 4,
    net: {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    },
  },
};

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function control(body) {
  await fetch(`${BASE}/__control`, { method: 'POST', body: JSON.stringify(body) });
}

async function throttle(page, profile) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
  if (profile.net) await session.send('Network.emulateNetworkConditions', profile.net);
}

/** Navigation start to the first record row, and the paint timings, in one load. */
async function load(page, url) {
  await page.addInitScript(() => {
    window.__t = {};
    new MutationObserver((_m, obs) => {
      if (document.querySelector('.list-scroll .row[data-id]')) {
        window.__t.row = performance.now();
        obs.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (e.name === 'first-contentful-paint') window.__t.fcp = e.startTime;
    }).observe({ type: 'paint', buffered: true });
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__t?.row, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  return page.evaluate(() => window.__t);
}

async function measure(name, profile) {
  const cold = [];
  const warm = [];
  const coldFcp = [];
  const warmFcp = [];
  for (let i = 0; i < RUNS; i += 1) {
    const browser = await chromium.launch({ executablePath: exe });
    const context = await browser.newContext({ ...profile.options, serviceWorkers: 'allow' });
    const first = await context.newPage();
    await throttle(first, profile);
    const c = await load(first, `${BASE}/`);
    cold.push(c.row);
    coldFcp.push(c.fcp);
    // Let the worker take over and the index be stored, then start again on a new page.
    await first.evaluate(() => navigator.serviceWorker.ready);
    await first.waitForTimeout(1500);
    await first.close();
    const second = await context.newPage();
    await throttle(second, profile);
    const w = await load(second, `${BASE}/`);
    warm.push(w.row);
    warmFcp.push(w.fcp);
    await browser.close();
  }
  console.log(
    `${name.padEnd(26)} cold row ${median(cold).toFixed(0)} ms (FCP ${median(coldFcp.filter(Boolean)).toFixed(0)})   warm row ${median(warm).toFixed(0)} ms (FCP ${median(warmFcp.filter(Boolean)).toFixed(0)})   runs=${RUNS}`,
  );
}

await control({ docs: 60, latency: LATENCY });
console.log(`API latency ${LATENCY} ms per request; time to first record row, median of ${RUNS}`);
for (const [name, profile] of Object.entries(PROFILES)) await measure(name, profile);
await control({ docs: 40, latency: 0 });
