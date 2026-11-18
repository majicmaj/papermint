/**
 * Raise the phone keyboard from a tap. A phone only shows the keyboard for a focus that happens
 * inside the tap itself, but the palette input does not exist yet. A tiny input takes focus now
 * and the palette input takes it over a moment later, so the keyboard never drops in between.
 */
export function raiseKeyboard(): void {
  const proxy = document.createElement('input');
  proxy.setAttribute('aria-hidden', 'true');
  proxy.tabIndex = -1;
  proxy.className = 'keyboard-proxy';
  document.body.appendChild(proxy);
  proxy.focus({ preventScroll: true });
  setTimeout(() => proxy.remove(), 800);
}
