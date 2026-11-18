import { runtimeConfig } from '../config/runtime';
import { searchFullText, downloadUrl } from '../api/documents';
import type { Doc } from '../api/types';
import { formatDate } from '../domain/format';
import { statusTag } from '../domain/tags';
import { resolveVersion, versionName } from '../domain/versions';
import { VIEW_LABEL, archiveRecords, visibleViews } from '../domain/views';
import { PaletteController, type Command, type Entry, type IdleContent } from '../palette';
import { copyLink } from '../shell/copy-link';
import { appStore, notify } from './app';
import { uploadFiles } from './uploads';
import { popLayer, pushLayer } from './modal';
import { clearFiltersCommand } from './filters';
import { currentRoute, goToView, navigate, recordPath, routeStore, type Route } from './router';

export function triggerDownload(id: number, version?: number): void {
  const link = document.createElement('a');
  link.href = downloadUrl(id, version);
  link.download = '';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Palette entries in display order: Records, then superseded documents. */
export function paletteEntries(): Entry[] {
  const { docs, model } = appStore.get();
  const seen = new Set<number>();
  const records = [...archiveRecords(docs, model)].sort(
    (a, b) => b.created.localeCompare(a.created) || b.id - a.id,
  );
  const included = new Set(records.map((doc) => doc.id));
  const ordered = [...records, ...docs.filter((doc) => !included.has(doc.id))];
  return ordered.flatMap((doc) => {
    if (seen.has(doc.id)) return [];
    seen.add(doc.id);
    const status = statusTag(doc, model);
    const badge = status ? { label: status.name, color: status.color } : undefined;
    return [{ id: doc.id, title: doc.title, hint: formatDate(doc.created), badge }];
  });
}

type RecordRoute = Extract<Route, { name: 'record' }>;

const RECENT_LIMIT = 4;
// Keep history in memory only, including when a sensitive record was opened.
let recent: number[] = [];
let fetchedRecord: Doc | null = null;

/** The pane can load a deep-linked record before it exists in the document index. */
export function registerPaletteRecord(doc: Doc): () => void {
  fetchedRecord = doc;
  palette.refresh();
  return () => {
    if (fetchedRecord === doc) fetchedRecord = null;
  };
}

function rememberRecord(): void {
  const { route } = routeStore.get();
  if (route.name !== 'record') return;
  recent = [route.id, ...recent.filter((id) => id !== route.id)].slice(0, RECENT_LIMIT);
}

rememberRecord();
routeStore.subscribe(rememberRecord);

function recentEntries(): Entry[] {
  const entries = paletteEntries();
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const opened = recent.flatMap((id) => byId.get(id) ?? []);
  return opened.length > 0 ? opened : entries.slice(0, RECENT_LIMIT);
}

function versionCommands(doc: Doc, route: RecordRoute): IdleContent {
  const resolved = resolveVersion(doc, route.version);
  const selected = resolved.state === 'ok' ? resolved.id : null;
  return {
    title: doc.title,
    selected: Math.max(
      0,
      doc.versions.findIndex((version) => version.id === selected),
    ),
    commands: doc.versions.map((version) => ({
      title: versionName(version),
      icon: version.id === selected ? 'check' : 'file_text',
      detail: version.id === selected ? 'Selected' : undefined,
      run: () => navigate(recordPath(doc.id, version.id), { from: route.from }),
    })),
  };
}

function recordCommands(doc: Doc, route: RecordRoute): IdleContent {
  const commands: Command[] = [];
  const resolved = resolveVersion(doc, route.version);
  if (resolved.state === 'ok') {
    commands.push(
      {
        title: 'Download selected version',
        icon: 'download',
        run: () => triggerDownload(doc.id, resolved.id),
      },
      {
        title: 'Copy link',
        icon: 'link',
        run: () => {
          void copyLink(recordPath(doc.id, route.version)).then(
            (ok) => ok && notify('Link copied'),
          );
        },
      },
    );
  }
  if (doc.versions.length > 1) {
    commands.push({
      title: 'Open versions',
      icon: 'layers',
      run: () => versionCommands(doc, route),
    });
  }
  return { title: doc.title, commands };
}

function paletteIdle(): IdleContent {
  const route = currentRoute();
  if (route.name === 'record') {
    const doc =
      appStore.get().docs.find((item) => item.id === route.id) ??
      (fetchedRecord?.id === route.id ? fetchedRecord : null);
    if (doc) return recordCommands(doc, route);
  }
  const view = route.name === 'file' ? 'recovery' : route.name;
  const commands: Command[] = visibleViews().flatMap((target) =>
    target === view
      ? []
      : [
          {
            title: `Go to ${VIEW_LABEL[target]}`,
            icon: target === 'records' ? 'files' : 'life_buoy',
            run: () => goToView(target),
          },
        ],
  );
  const clear = view === 'records' ? clearFiltersCommand() : undefined;
  if (clear) commands.push({ title: 'Clear filters', icon: 'list_filter', run: clear });
  if (!runtimeConfig().readOnly) commands.push({ title: 'Upload', icon: 'upload', run: pickFiles });
  return { entries: recentEntries(), commands };
}

export const palette = new PaletteController({
  getEntries: paletteEntries,
  getIdle: paletteIdle,
  fullText: (query, signal) => searchFullText(query, signal),
  onActivate: (id, mode) => {
    if (mode === 'download') triggerDownload(id);
    else navigate(recordPath(id));
  },
});

let indexed = appStore.get().docs;
appStore.subscribe(() => {
  const docs = appStore.get().docs;
  if (docs === indexed) return;
  indexed = docs;
  palette.refresh();
});

export function pickFiles(): void {
  if (runtimeConfig().readOnly) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length > 0) {
      void uploadFiles(files);
      if (currentRoute().name !== 'records') goToView('records');
    }
  };
  input.click();
}

let paletteLayer: number | null = null;

/** Open the palette as a modal layer. The opener is captured before the page goes inert. */
export function openPalette(): void {
  if (paletteLayer === null) paletteLayer = pushLayer(true);
  palette.open();
}

palette.subscribe((state) => {
  if (state.open || paletteLayer === null) return;
  popLayer(paletteLayer);
  paletteLayer = null;
});
