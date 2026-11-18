import { type ViewName } from '../domain/views';
import type { SwapKind } from '../motion/transition';
import type { AppConfig } from '../config/config';
import { runtimeConfig } from '../config/runtime';
import { recoveryFile } from '../shell/recovery-files';

export type Route =
  | { name: ViewName }
  | { name: 'record'; id: number; version: number | null; from: ViewName | null }
  | { name: 'file'; key: string; from: ViewName | null };

export function parseRoute(
  path: string,
  search = '',
  source: ViewName | 'pending' | null = null,
  config: AppConfig = runtimeConfig(),
): Route {
  const hasRecovery = config.recoveryFiles.length > 0;
  const from = source === 'pending' ? 'records' : source;
  const back = from === 'recovery' && !hasRecovery ? null : from;
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const record = /^\/r\/(\d+)$/.exec(trimmed);
  if (record) {
    const version = new URLSearchParams(search).get('v');
    return {
      name: 'record',
      id: Number(record[1]),
      version: version && /^\d+$/.test(version) ? Number(version) : null,
      from: back,
    };
  }
  if (trimmed === '/recovery' && hasRecovery) return { name: 'recovery' };
  const file = /^\/f\/([a-z0-9-]+)$/.exec(trimmed);
  const known = file ? recoveryFile(file[1]!, config.recoveryFiles) : null;
  if (known) return { name: 'file', key: known.key, from: back };
  return { name: 'records' };
}

export function recordPath(id: number, version: number | null = null): string {
  return `/r/${id}${version ? `?v=${version}` : ''}`;
}

const showsPane = (route: Route) => route.name === 'record' || route.name === 'file';

/**
 * What the owner sees change. The pane arriving or leaving cross-fades the page and slides the
 * pane; a switch of view cross-fades the results. A phone has no pane column: its record sheet
 * brings its own motion. Moving from one record to the next changes content in place.
 */
export function transitionFor(from: Route, to: Route, mobile: boolean): SwapKind | null {
  if (showsPane(from) !== showsPane(to)) return mobile ? null : 'pane';
  if (!showsPane(to) && from.name !== to.name) return 'results';
  return null;
}
