import { searchFullText, downloadUrl } from '../api/documents';
import { formatDate } from '../domain/format';
import { statusTag } from '../domain/tags';
import { listView, VIEWS } from '../domain/views';
import { PaletteController, type Entry } from '../palette';
import { appStore } from './app';
import { uploadFiles } from './uploads';
import { popLayer, pushLayer } from './modal';
import { navigate, recordPath } from './router';

export function triggerDownload(id: number, version?: number): void {
  const link = document.createElement('a');
  link.href = downloadUrl(id, version);
  link.download = '';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Palette entries in display order: Records, then Pending, then the rest. */
export function paletteEntries(): Entry[] {
  const { docs, model } = appStore.get();
  const seen = new Set<number>();
  const ordered = VIEWS.filter((v) => v !== 'recovery').flatMap((view) =>
    listView(docs, view, model, null),
  );
  for (const doc of docs) {
    if (!ordered.includes(doc)) ordered.push(doc);
  }
  return ordered.flatMap((doc) => {
    if (seen.has(doc.id)) return [];
    seen.add(doc.id);
    const status = statusTag(doc, model);
    const badge = status ? { label: status.name, color: status.color } : undefined;
    return [{ id: doc.id, title: doc.title, hint: formatDate(doc.created), badge }];
  });
}

export const palette = new PaletteController({
  getEntries: paletteEntries,
  fullText: (query, signal) => searchFullText(query, signal),
  onActivate: (id, mode) => {
    if (mode === 'download') triggerDownload(id);
    else navigate(recordPath(id));
  },
});

export function pickFiles(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length > 0) {
      void uploadFiles(files);
      navigate('/pending');
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
