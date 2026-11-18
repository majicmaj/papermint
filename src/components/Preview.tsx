import { useEffect, useState } from 'preact/hooks';
import type { Doc } from '../api/types';
import { previewUrl } from '../api/documents';
import { forgetRecord, loadPreview, peekPreview } from '../api/preview-store';
import type { FileKind } from '../domain/format';
import { kindFromContentType } from '../domain/format';
import { Icon } from '../icons/Icon';

type Shown =
  | { state: 'loading' }
  | { state: 'text'; text: string }
  | { state: 'file'; kind: FileKind; url: string }
  | { state: 'failed' };

/**
 * One request with `cache: 'no-store'` reads the file the preview URL really serves. The
 * renderer follows its Content-Type: the root record's mime type describes its oldest file and
 * is wrong for a newer version. Images and frames show from an object URL, which is revoked
 * when the preview goes away, so no copy stays in any cache.
 */
function useShown(src: string, sensitive: boolean): [Shown, () => void] {
  const [shown, setShown] = useState<Shown>({ state: 'loading' });
  useEffect(() => {
    const abort = new AbortController();
    let url: string | null = null;
    setShown({ state: 'loading' });
    if (sensitive) forgetRecord(Number(/\/documents\/(\d+)\//.exec(src)?.[1]));
    const ahead = sensitive ? undefined : peekPreview(src);
    (async () => {
      const file = ahead ?? (await loadPreview(src, { signal: abort.signal }));
      const kind = kindFromContentType(file.type);
      if (abort.signal.aborted) return;
      if (kind === 'text') return setShown({ state: 'text', text: await file.blob.text() });
      url = URL.createObjectURL(file.blob.slice(0, file.blob.size, file.type));
      setShown({ state: 'file', kind, url });
    })().catch(() => !abort.signal.aborted && setShown({ state: 'failed' }));
    return () => {
      abort.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [src, sensitive]);
  return [shown, () => setShown({ state: 'failed' })];
}

function TextPreview({ text }: { text: string }) {
  return (
    <div class="preview-scroll">
      <pre class="preview-text">{text}</pre>
    </div>
  );
}

export function PreviewFailed() {
  return (
    <div class="preview-failed">
      <Icon name="file_x" size={28} />
      <span>Unavailable</span>
    </div>
  );
}

interface Props {
  doc: Doc;
  /** The exact version id to show. */
  version: number;
  /** Sensitive records are read fresh every time and nothing is kept for them. */
  sensitive: boolean;
}

/** Fills a fixed-size pane. Nothing here changes the pane geometry. */
export function Preview({ doc, version, sensitive }: Props) {
  const src = previewUrl(doc.id, version);
  const [shown, fail] = useShown(src, sensitive);
  if (shown.state === 'loading') return null;
  if (shown.state === 'failed') return <PreviewFailed />;
  if (shown.state === 'text') return <TextPreview key={src} text={shown.text} />;
  if (shown.kind === 'image') {
    return (
      <div class="preview-image">
        <img key={src} src={shown.url} alt={doc.title} decoding="async" onError={fail} />
      </div>
    );
  }
  const frame = shown.kind === 'pdf' ? `${shown.url}#view=FitH&navpanes=0` : shown.url;
  return <iframe key={src} class="preview-frame" src={frame} title={doc.title} />;
}
