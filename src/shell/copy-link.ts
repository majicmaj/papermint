import { notify } from '../state/app';
import { copyText } from '../state/clipboard';

/** Copy a link to this app. True if the browser accepted it; a short notice says if not. */
export async function copyLink(path: string): Promise<boolean> {
  const ok = await copyText(`${location.origin}${path}`);
  if (!ok) notify('Copy failed');
  return ok;
}
