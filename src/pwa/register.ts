import { writesInFlight } from '../api/http';
import { BASE, withBase } from '../base';
import { appStore } from '../state/app';
import { anyLayerOpen } from '../state/modal';
import { mayApply, reloadAllowed, type Activity } from './update-policy';

/**
 * Register the worker, look for updates often, and apply one by itself at a safe moment.
 *
 * A new worker installs in the background and takes over at once (sw.ts), so the next load
 * always runs the new build. This page still runs the old build: it reloads into the new one,
 * on the same URL, when update-policy.ts allows it. That happens at launch before the first
 * click, or while the window is hidden or out of focus, and never while work could be lost.
 * A worker that still waits (a build older than this one) is asked to take over the same way.
 */

/** Look for a new build this often while the app is open. */
const CHECK_EVERY_MS = 10 * 60_000;
/** Do not ask the server again sooner than this. */
const CHECK_GAP_MS = 30_000;
/** After focus leaves, wait this long: a click into the preview frame also takes focus. */
const AWAY_DELAY_MS = 1500;
/** How long to wait for the new worker to take over after the page asked. */
const GIVE_UP_MS = 10_000;
const RELOADED_AT = 'majin.updateReloadAt';

const loadedAt = performance.now();
let interacted = false;
let applying = false;

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  for (const type of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(type, () => (interacted = true), { capture: true, once: true });
  }
  const register = () => {
    navigator.serviceWorker
      .register(withBase('/sw.js'), { scope: BASE })
      .then(watchForUpdates)
      .catch(() => undefined);
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

function textHeld(): boolean {
  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'textarea, input:not([type]), input[type="text"], input[type="search"]',
  );
  return Array.from(fields).some((field) => field.value.trim() !== '');
}

function activity(): Activity {
  return {
    uploads: appStore.get().uploads.length,
    writes: writesInFlight(),
    layerOpen: anyLayerOpen(),
    textHeld: textHeld(),
  };
}

function safeNow(): boolean {
  const moment = {
    hidden: document.visibilityState === 'hidden',
    focused: document.hasFocus(),
    interacted,
    sinceLoadMs: performance.now() - loadedAt,
  };
  return mayApply(moment, activity());
}

function lastReloadAt(): number | null {
  try {
    const value = Number(sessionStorage.getItem(RELOADED_AT));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

function reload(): void {
  if (!reloadAllowed(lastReloadAt(), Date.now())) return;
  try {
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    // Without storage the guard is gone, but one update still reloads only once.
  }
  window.location.reload();
}

function watchForUpdates(registration: ServiceWorkerRegistration): void {
  const container = navigator.serviceWorker;
  let controller = container.controller;
  // True when a newer worker already controls this page, which still runs the old build.
  let stale = false;

  const tryApply = () => {
    if (applying || !safeNow()) return;
    if (stale) return reload();
    const waiting = registration.waiting;
    // With no controller, this is the first install: it takes over by itself, nothing to apply.
    if (!waiting || !container.controller) return;
    applying = true;
    waiting.postMessage({ type: 'activate' });
    // If the hand-over never comes, try again at the next chance.
    setTimeout(() => (applying = false), GIVE_UP_MS);
  };

  container.addEventListener('controllerchange', () => {
    const previous = controller;
    controller = container.controller;
    // The very first worker takes over a page that already runs the current build.
    if (!previous) return;
    stale = true;
    if (applying) reload();
    else tryApply();
  });

  // A worker that finishes installing gets its first chance at once.
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') tryApply();
    });
  });

  let checkedAt = 0;
  const check = () => {
    if (Date.now() - checkedAt < CHECK_GAP_MS) return tryApply();
    checkedAt = Date.now();
    registration
      .update()
      .catch(() => undefined)
      .finally(tryApply);
  };

  // Leaving hands the waiting worker over, so the next launch runs the new build.
  window.addEventListener('pagehide', () =>
    registration.waiting?.postMessage({ type: 'activate' }),
  );
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') tryApply();
    else check();
  });
  window.addEventListener('focus', check);
  window.addEventListener('online', check);
  window.addEventListener('blur', () => setTimeout(tryApply, AWAY_DELAY_MS));
  setInterval(() => {
    if (document.visibilityState === 'visible') check();
  }, CHECK_EVERY_MS);
  // A worker may already wait from an earlier visit, or the server may have a newer build.
  tryApply();
  check();
}
