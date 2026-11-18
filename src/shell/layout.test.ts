import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULTS,
  LAYOUT_KEY,
  PANE_MIN,
  clampWidth,
  maxWidth,
  parseLayout,
  serializeLayout,
} from './layout';

describe('column widths', () => {
  it('clamps to the limits', () => {
    expect(clampWidth('rail', 50)).toBe(180);
    expect(clampWidth('rail', 999)).toBe(320);
    expect(clampWidth('list', 100)).toBe(320);
    expect(clampWidth('list', 5000)).toBe(720);
  });

  it('leaves room for the preview pane', () => {
    const layout = { rail: 216, list: 440, collapsed: false };
    expect(maxWidth('list', layout, 1000)).toBe(1000 - 216 - PANE_MIN);
    expect(clampWidth('list', 720, layout, 1000)).toBe(424);
    // On a tiny window the minimum still wins.
    expect(clampWidth('list', 600, layout, 500)).toBe(320);
  });

  it('round-trips a saved layout', () => {
    const layout = { rail: 250, list: 500, collapsed: true };
    expect(parseLayout(serializeLayout(layout))).toEqual(layout);
  });

  it('falls back to defaults for missing or broken data', () => {
    expect(parseLayout(null)).toEqual(DEFAULTS);
    expect(parseLayout('not json')).toEqual(DEFAULTS);
    expect(parseLayout('{"rail":"wide","list":null}')).toEqual(DEFAULTS);
  });

  it('clamps saved values that are out of range', () => {
    expect(parseLayout('{"rail":9999,"list":1}')).toEqual({
      rail: 320,
      list: 320,
      collapsed: false,
    });
  });
});

describe('first-paint script', () => {
  const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

  /** Run the inline script against a fake page, as the browser does before the app loads. */
  function run(stored: string | null): Record<string, string> {
    const vars: Record<string, string> = {};
    const env = {
      localStorage: { getItem: (key: string) => (key === LAYOUT_KEY ? stored : null) },
      document: {
        documentElement: {
          style: { setProperty: (k: string, v: string) => (vars[k] = v) },
          setAttribute: (k: string) => (vars[k] = ''),
        },
      },
    };
    new Function('localStorage', 'document', script)(env.localStorage, env.document);
    return vars;
  }

  it('is in the HTML head, before the app script', () => {
    expect(script).not.toBe('');
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('type="module"'));
  });

  it('applies saved widths exactly as the app parses them', () => {
    for (const stored of ['{"rail":250,"list":500}', '{"rail":9999,"list":1}', '{"rail":200}']) {
      const parsed = parseLayout(stored);
      const vars = run(stored);
      expect(vars['--rail'] ?? `${DEFAULTS.rail}px`).toBe(`${parsed.rail}px`);
      expect(vars['--list'] ?? `${DEFAULTS.list}px`).toBe(`${parsed.list}px`);
    }
  });

  it('restores a folded sidebar before the app runs', () => {
    expect(run('{"rail":216,"list":440,"collapsed":true}')['data-rail-collapsed']).toBe('');
    expect(run('{"rail":216,"list":440,"collapsed":false}')['data-rail-collapsed']).toBeUndefined();
    expect(parseLayout('{"collapsed":true}').collapsed).toBe(true);
    expect(parseLayout('{"collapsed":"yes"}').collapsed).toBe(false);
  });

  it('does nothing when nothing is saved or the data is broken', () => {
    expect(run(null)).toEqual({});
    expect(run('garbage')).toEqual({});
  });
});
