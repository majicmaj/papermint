export interface ClipboardDeps {
  write?: (text: string) => Promise<void>;
  legacy?: (text: string) => boolean;
}

function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/** Copy text. Resolves true only if the browser accepted the copy. */
export async function copyText(text: string, deps: ClipboardDeps = {}): Promise<boolean> {
  const write = deps.write ?? navigator.clipboard?.writeText.bind(navigator.clipboard);
  if (write) {
    try {
      await write(text);
      return true;
    } catch {
      // Fall back below: some contexts refuse the async API.
    }
  }
  return (deps.legacy ?? legacyCopy)(text);
}
