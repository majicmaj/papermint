import { render, type ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';

/**
 * Draws its children into a node of `document.body`, outside the page shell. The shell turns
 * inert while a modal layer is open, so a layer that lives inside it would be inert too.
 * Stores are module-level in this app, so the portal needs no context.
 */
export function Portal({ children }: { children: ComponentChildren }) {
  const host = useRef<HTMLDivElement | null>(null);
  if (!host.current) host.current = document.createElement('div');
  useLayoutEffect(() => {
    const node = host.current!;
    document.body.appendChild(node);
    return () => {
      render(null, node);
      node.remove();
    };
  }, []);
  // After every render of the owner, so the portal never shows older props.
  useLayoutEffect(() => render(<>{children}</>, host.current!));
  return null;
}
