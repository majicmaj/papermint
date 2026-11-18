import type { ProxyOptions } from 'vite';

/** The slash is intentional: /recovery itself belongs to Papermint. */
export const PROXIED_PATHS = [
  '/api/',
  '/media/',
  '/static/',
  '/accounts/',
  '/recovery/',
  '/recovery-files/',
  '/backups/',
] as const;

/** An explicit, trusted dev target only. The production proxy is configured separately. */
export function buildProxy(target?: string): Record<string, ProxyOptions> {
  if (!target) return {};
  const origin = new URL(target).origin;
  const options: ProxyOptions = {
    target: origin,
    changeOrigin: true,
    secure: true,
    headers: { Referer: `${origin}/`, Origin: origin },
  };
  return Object.fromEntries(PROXIED_PATHS.map((path) => [path, options]));
}
