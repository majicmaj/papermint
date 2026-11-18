import type { Doc, Tag } from '../api/types';
import { previewUrl } from '../api/documents';
import { hasPreview, keepPreview, loadPreview } from '../api/preview-store';
import { currentVersionId } from '../domain/versions';
import { sensitive } from '../domain/record-details';

const HOVER_MS = 80;
const started = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Whether this record's preview may be fetched ahead of a click. Sensitive records never are. */
export function mayPrefetch(doc: Doc, tags: readonly Tag[]): boolean {
  if (sensitive(doc, tags)) return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return navigator.onLine !== false && nav.connection?.saveData !== true;
}

/** Fetch the preview now, at low priority, and keep it in memory (never on disk) for the click. */
export function prefetchPreview(doc: Doc, tags: readonly Tag[]): void {
  if (!mayPrefetch(doc, tags)) return;
  const url = previewUrl(doc.id, currentVersionId(doc));
  if (started.has(url) || hasPreview(url)) return;
  started.add(url);
  loadPreview(url, { priority: 'low' } as RequestInit)
    .then((file) => {
      // The record may have turned Sensitive while this was on its way: the check is done again.
      if (mayPrefetch(doc, tags)) keepPreview(url, file);
    })
    .catch(() => undefined)
    .finally(() => started.delete(url));
}

/**
 * Pointer, focus or press on a row means a click is likely. A press goes at once; hovering
 * waits a moment so a pointer sweeping across the list fetches nothing.
 */
export function rowIntent(doc: Doc, tags: readonly Tag[]) {
  return {
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => prefetchPreview(doc, tags), HOVER_MS);
    },
    onPointerLeave: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
    onPointerDown: () => prefetchPreview(doc, tags),
    onFocus: () => prefetchPreview(doc, tags),
  };
}
