import { useEffect, useState } from 'preact/hooks';
import type { RecoveryFile } from './recovery-files';

export type Content =
  | { state: 'loading' }
  | { state: 'text'; text: string }
  | { state: 'pdf'; url: string }
  | { state: 'archive'; size: number | null }
  | { state: 'failed' };

const NO_STORE: RequestInit = {
  cache: 'no-store',
  mode: 'same-origin',
  credentials: 'same-origin',
  redirect: 'error',
};

/**
 * Load a recovery file for viewing. The server sends these as attachments, so the body is
 * read as a blob and shown from an object URL: the browser displays it instead of saving it.
 * The contents live only in this hook: no cache, no storage, and the URL is revoked on close.
 * An archive is never downloaded here; its size comes from a HEAD request.
 */
export function useRecoveryContent(file: RecoveryFile): Content {
  const [content, setContent] = useState<Content>({ state: 'loading' });
  useEffect(() => {
    const abort = new AbortController();
    let url: string | null = null;
    setContent({ state: 'loading' });
    load(file, abort.signal, (next) => {
      if (next.state === 'pdf') url = next.url;
      if (abort.signal.aborted) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      setContent(next);
    });
    return () => {
      abort.abort();
      if (url) URL.revokeObjectURL(url);
      setContent({ state: 'loading' });
    };
  }, [file.key]);
  return content;
}

function load(file: RecoveryFile, signal: AbortSignal, done: (content: Content) => void): void {
  const fail = () => !signal.aborted && done({ state: 'failed' });
  if (file.kind === 'archive') {
    fetch(file.href, { ...NO_STORE, method: 'HEAD', signal })
      .then((response) => {
        if (!response.ok) return fail();
        const length = Number(response.headers.get('content-length'));
        done({ state: 'archive', size: Number.isFinite(length) && length > 0 ? length : null });
      })
      .catch(fail);
    return;
  }
  fetch(file.href, { ...NO_STORE, signal })
    .then(async (response) => {
      if (!response.ok) return fail();
      const blob = await response.blob();
      if (file.kind === 'text') return done({ state: 'text', text: await blob.text() });
      const typed = blob.slice(0, blob.size, 'application/pdf');
      done({ state: 'pdf', url: URL.createObjectURL(typed) });
    })
    .catch(fail);
}
