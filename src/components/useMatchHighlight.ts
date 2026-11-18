import { useLayoutEffect } from 'preact/hooks';
import type { Item, Range as Span } from '../palette';

export const HIGHLIGHT_NAME = 'result-match';

/** The CSS Custom Highlight API paints a match without splitting the text into nodes. */
export function highlightsSupported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function';
}

/** Character ranges of the hits inside a snippet, as if its segments were one string. */
export function snippetRanges(snippet: Item['snippet']): Span[] {
  const spans: Span[] = [];
  let at = 0;
  for (const part of snippet ?? []) {
    if (part.hit) spans.push([at, at + part.text.length]);
    at += part.text.length;
  }
  return spans;
}

function rangesIn(node: Node | null | undefined, spans: Span[]): AbstractRange[] {
  if (!node || node.nodeType !== Node.TEXT_NODE) return [];
  const length = node.textContent?.length ?? 0;
  return spans.flatMap(([start, end]) => {
    if (start >= length) return [];
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, Math.min(end, length));
    return [range];
  });
}

/**
 * Highlight the matches of every result row. Each row keeps one text node for its title and one
 * for its second line, so a new query changes the paint of a row and never its layout.
 */
export function useMatchHighlight(root: { current: HTMLElement | null }, items: Item[]): void {
  useLayoutEffect(() => {
    if (!highlightsSupported() || !root.current) return;
    const rows = Array.from(root.current.querySelectorAll('.result'));
    const ranges = rows.flatMap((row, index) => {
      const item = items[index];
      if (!item) return [];
      return [
        ...rangesIn(row.querySelector('.result-title')?.firstChild, item.ranges),
        ...rangesIn(row.querySelector('.result-sub')?.firstChild, snippetRanges(item.snippet)),
      ];
    });
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
    return () => void CSS.highlights.delete(HIGHLIGHT_NAME);
  });
}
