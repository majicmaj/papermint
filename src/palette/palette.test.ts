import { describe, expect, it, vi } from 'vitest';
import { PaletteController, matchTitle, mergeRanges, parseHighlights } from './index';
import type { Entry, FullTextHit } from './index';

describe('matchTitle', () => {
  it('ranks prefix above word start above substring', () => {
    const prefix = matchTitle('Operating agreement', 'oper')!;
    const word = matchTitle('Signed operating agreement', 'oper')!;
    const inner = matchTitle('Cooperating parties', 'oper')!;
    expect(prefix.score).toBeGreaterThan(word.score);
    expect(word.score).toBeGreaterThan(inner.score);
  });

  it('requires every token to match', () => {
    expect(matchTitle('Operating agreement', 'oper agree')).not.toBeNull();
    expect(matchTitle('Operating agreement', 'oper zzz')).toBeNull();
  });

  it('returns highlight ranges', () => {
    expect(matchTitle('Tax return 2025', 'tax')!.ranges).toEqual([[0, 3]]);
  });

  it('tolerates dropped letters in longer tokens, but not scattered ones', () => {
    expect(matchTitle('Operating agreement', 'oprt')).not.toBeNull();
    expect(matchTitle('Operating agreement', 'oz')).toBeNull();
    expect(matchTitle('Operating agreement', 'ein')).toBeNull();
  });

  it('merges touching ranges', () => {
    expect(
      mergeRanges([
        [0, 2],
        [2, 4],
        [6, 7],
      ]),
    ).toEqual([
      [0, 4],
      [6, 7],
    ]);
  });
});

describe('parseHighlights', () => {
  it('marks <b> as a hit and drops other tags', () => {
    const out = parseHighlights('see <b>EIN</b> <script>x</script>letter &amp; more');
    expect(out.filter((s) => s.hit).map((s) => s.text)).toEqual(['EIN']);
    expect(out.map((s) => s.text).join('')).toContain('& more');
    expect(out.map((s) => s.text).join('')).not.toContain('<');
  });

  it('clips at a word boundary and marks the cut', () => {
    const out = parseHighlights('alpha beta gamma delta epsilon zeta', 18);
    const text = out.map((s) => s.text).join('');
    expect(text).toBe('alpha beta gamma…');
  });

  it('never cuts inside a word, even with a hit', () => {
    const out = parseHighlights('one two <b>three</b> four five six seven', 22);
    const text = out.map((s) => s.text).join('');
    expect(text.endsWith('…')).toBe(true);
    expect(
      text
        .replace('…', '')
        .trim()
        .split(' ')
        .every((w) => 'one two three four five six seven'.split(' ').includes(w)),
    ).toBe(true);
  });

  it('keeps short snippets whole', () => {
    expect(
      parseHighlights('short text', 50)
        .map((s) => s.text)
        .join(''),
    ).toBe('short text');
  });
});

const entries: Entry[] = [
  { id: 1, title: 'Operating agreement (signed)' },
  { id: 2, title: 'EIN confirmation letter' },
  { id: 3, title: 'Operating agreement (draft)' },
];

function make(hits: FullTextHit[] = []) {
  const onActivate = vi.fn();
  const fullText = vi.fn(async () => hits);
  const palette = new PaletteController({
    getEntries: () => entries,
    fullText,
    onActivate,
    debounceMs: 0,
  });
  return { palette, onActivate, fullText };
}

describe('PaletteController', () => {
  it('shows the index in order for an empty query', () => {
    const { palette } = make();
    palette.open();
    expect(palette.getState().items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('filters titles instantly, before full text answers', () => {
    const { palette } = make();
    palette.open();
    palette.setQuery('ein');
    expect(palette.getState().items.map((i) => i.id)).toEqual([2]);
    expect(palette.getState().searching).toBe(true);
  });

  it('appends full-text hits that are not title matches', async () => {
    const { palette } = make([
      { id: 2, title: 'EIN confirmation letter', snippet: 'a <b>ein</b>' },
      { id: 9, title: 'Bank letter', snippet: 'mentions <b>ein</b> twice' },
    ]);
    palette.open();
    palette.setQuery('ein');
    await vi.waitFor(() => expect(palette.getState().searching).toBe(false));
    const items = palette.getState().items;
    expect(items.map((i) => i.id)).toEqual([2, 9]);
    expect(items[1]?.source).toBe('text');
    expect(items[1]?.snippet?.some((s) => s.hit)).toBe(true);
  });

  it('activates the clicked item, not the highlighted one', () => {
    const { palette, onActivate } = make();
    palette.open();
    expect(palette.getState().selected).toBe(0);
    palette.activate('open', 2);
    expect(onActivate).toHaveBeenCalledWith(3, 'open');
  });

  it('opens with Enter and downloads with the download mode', () => {
    const { palette, onActivate } = make();
    palette.open();
    palette.move(1);
    palette.activate('download');
    expect(onActivate).toHaveBeenCalledWith(2, 'download');
    expect(palette.getState().open).toBe(true);
    palette.activate('open');
    expect(onActivate).toHaveBeenLastCalledWith(2, 'open');
    expect(palette.getState().open).toBe(false);
  });

  it('wraps selection', () => {
    const { palette } = make();
    palette.open();
    palette.move(-1);
    expect(palette.getState().selected).toBe(2);
    palette.move(1);
    expect(palette.getState().selected).toBe(0);
  });

  it('skips full text for one-character queries', () => {
    const { palette, fullText } = make();
    palette.open();
    palette.setQuery('e');
    expect(fullText).not.toHaveBeenCalled();
  });
});

describe('PaletteController failures', () => {
  it('flags a failed full-text search, keeps title matches, and retries', async () => {
    const onActivate = vi.fn();
    let fail = true;
    const fullText = vi.fn(async () => {
      if (fail) throw new Error('network');
      return [{ id: 9, title: 'Bank letter', snippet: '<b>ein</b>' }];
    });
    const palette = new PaletteController({
      getEntries: () => entries,
      fullText,
      onActivate,
      debounceMs: 0,
    });
    palette.open();
    palette.setQuery('ein');
    await vi.waitFor(() => expect(palette.getState().failed).toBe(true));
    expect(palette.getState().searching).toBe(false);
    expect(palette.getState().items.map((i) => i.id)).toEqual([2]);
    fail = false;
    palette.retry();
    expect(palette.getState().failed).toBe(false);
    await vi.waitFor(() => expect(palette.getState().items.map((i) => i.id)).toEqual([2, 9]));
    expect(fullText).toHaveBeenCalledTimes(2);
  });

  it('clears a failure when the query changes', async () => {
    const fullText = vi.fn(async () => {
      throw new Error('network');
    });
    const palette = new PaletteController({
      getEntries: () => entries,
      fullText,
      onActivate: vi.fn(),
      debounceMs: 0,
    });
    palette.open();
    palette.setQuery('zzz');
    await vi.waitFor(() => expect(palette.getState().failed).toBe(true));
    palette.setQuery('zz');
    expect(palette.getState().failed).toBe(false);
  });
});

describe('PaletteController full-text budget', () => {
  it('does not let title matches use up the full-text slots', async () => {
    const hits = [
      { id: 1, title: 'Operating agreement (signed)', snippet: '' },
      { id: 3, title: 'Operating agreement (draft)', snippet: '' },
      { id: 9, title: 'Bank letter', snippet: 'mentions <b>agreement</b>' },
    ];
    const palette = new PaletteController({
      getEntries: () => entries,
      fullText: async () => hits,
      onActivate: vi.fn(),
      debounceMs: 0,
      maxTextItems: 1,
    });
    palette.open();
    palette.setQuery('agreement');
    await vi.waitFor(() => expect(palette.getState().items.map((i) => i.id)).toContain(9));
    expect(palette.getState().items.filter((i) => i.source === 'text')).toHaveLength(1);
  });
});
