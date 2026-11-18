/**
 * The path the app is served under: `/` by default, or for example `/demo/` when the build
 * sets PAPERMINT_BASE. App paths in the code (`/r/5`, `/recovery`) are written without it.
 * The Paperless API stays at the root of the origin (`/api/`).
 */
export const BASE: string = import.meta.env.BASE_URL || '/';

const root = BASE.replace(/\/+$/, '');

/** An app path as the address bar shows it. */
export function withBase(path: string, base = BASE): string {
  const prefix = base.replace(/\/+$/, '');
  return prefix ? `${prefix}${path}` : path;
}

/** The app path of an address-bar path, or null when the path is outside the app. */
export function withoutBase(path: string, base = BASE): string | null {
  const prefix = base === BASE ? root : base.replace(/\/+$/, '');
  if (!prefix) return path;
  if (path === prefix) return '/';
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : null;
}
