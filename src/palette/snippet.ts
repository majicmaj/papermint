import type { Segment } from './types';

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};

function decode(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (entity) => ENTITIES[entity] ?? entity);
}

/**
 * Turn server highlight markup into plain segments. Only `<b>` marks a hit.
 * Every other tag is dropped, so the result is safe to render as text.
 */
export function parseHighlights(markup: string, maxLength = 120): Segment[] {
  const segments: Segment[] = [];
  let hit = false;
  for (const part of markup.split(/(<\/?[a-zA-Z][^>]*>)/)) {
    const tag = /^<(\/?)([a-zA-Z]+)/.exec(part);
    if (tag) {
      if (tag[2]?.toLowerCase() === 'b') hit = tag[1] !== '/';
      continue;
    }
    const text = decode(part).replace(/\s+/g, ' ');
    if (text) segments.push({ text, hit });
  }
  return clip(segments, maxLength);
}

/** Cut at a word boundary and mark the cut. The text of hits is never split. */
function clip(segments: Segment[], max: number): Segment[] {
  const out: Segment[] = [];
  let used = 0;
  for (const segment of segments) {
    if (used >= max) return markCut(out);
    const room = max - used;
    if (segment.text.length <= room) {
      out.push({ text: segment.text, hit: segment.hit });
      used += segment.text.length;
      continue;
    }
    const head = segment.text.slice(0, room + 1);
    const space = head.lastIndexOf(' ');
    const text = segment.hit || space <= 0 ? segment.text.slice(0, room) : head.slice(0, space);
    out.push({ text, hit: segment.hit });
    return markCut(out);
  }
  const first = out[0];
  if (first) first.text = first.text.replace(/^\s+/, '');
  return out;
}

function markCut(out: Segment[]): Segment[] {
  const last = out[out.length - 1];
  if (last) last.text = `${last.text.replace(/\s+$/, '')}…`;
  const first = out[0];
  if (first) first.text = first.text.replace(/^\s+/, '');
  return out;
}
