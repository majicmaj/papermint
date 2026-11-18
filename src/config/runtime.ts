import { DEFAULT_CONFIG, parseConfig, type AppConfig } from './config';

let config = DEFAULT_CONFIG;

export function runtimeConfig(): AppConfig {
  return config;
}

/** Read deployment preferences once before rendering. An offline shell uses safe defaults. */
export async function loadConfig(): Promise<void> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 1200);
  try {
    const response = await fetch('/config.json', {
      cache: 'no-store',
      mode: 'same-origin',
      credentials: 'same-origin',
      redirect: 'error',
      signal: abort.signal,
    });
    config = response.ok ? parseConfig(await response.json()) : DEFAULT_CONFIG;
  } catch {
    config = DEFAULT_CONFIG;
  } finally {
    clearTimeout(timeout);
  }
}
