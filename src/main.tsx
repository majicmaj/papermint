import { render } from 'preact';
import { App } from './App';
import { loadConfig } from './config/runtime';
import { refreshRoute } from './state/router';
import { hydrate } from './state/app';
import { flushCache, readCache } from './state/cache';
import { registerServiceWorker } from './pwa/register';
import { startConnectivity } from './pwa/connectivity';
import { migrateLegacyStorage, purgeLegacyCaches } from './data/index-store';
import { forgetPreviews } from './api/preview-store';
import './styles/index.css';

/** Wait for the stored index, but never long: a slow disk must not hold up the first paint. */
async function storedIndex() {
  // Old copies on disk are cut down first, with no network, then the index is read.
  const read = migrateLegacyStorage()
    .then(readCache)
    .catch(() => null);
  const slow = new Promise<null>((resolve) => setTimeout(() => resolve(null), 150));
  // If the disk was slow, the stored index still lands as soon as it is read (unless the network was first).
  void read.then(hydrate);
  return Promise.race([read, slow]);
}

async function start(): Promise<void> {
  // Earlier versions kept response caches. They are deleted.
  void purgeLegacyCaches();
  const [cached] = await Promise.all([storedIndex(), loadConfig()]);
  hydrate(cached);
  refreshRoute();
  const root = document.getElementById('app');
  if (root) render(<App />, root);
  window.addEventListener('pagehide', () => {
    forgetPreviews();
    void flushCache();
  });
  registerServiceWorker();
  startConnectivity();
}

void start();
