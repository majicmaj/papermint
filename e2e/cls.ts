import type { Page } from '@playwright/test';

export const CLS_LIMIT = 0.001;

export interface ShiftSource {
  /** The moved node: tag, classes and data-id. */
  node: string;
  value: number;
  from: string;
  to: string;
}

export interface Cls {
  /** Every layout shift, including shifts right after a click or key press. */
  total: number;
  /** Shifts the browser counts for the web-vitals CLS metric. */
  vitals: number;
  /** What moved, for every shift: the source nodes the browser reports. */
  shifts: { value: number; sources: ShiftSource[] }[];
}

export async function trackCls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: Cls };
    w.__cls = { total: 0, vitals: 0, shifts: [] };
    const name = (node: Node | null): string => {
      const el = node as HTMLElement | null;
      if (!el || !el.tagName) return String(node?.nodeName ?? 'unknown');
      const id = el.getAttribute('data-id');
      const text = (el.textContent ?? '').trim().slice(0, 24);
      return `${el.tagName.toLowerCase()}.${String(el.className).split(' ').join('.')}${id ? `[data-id=${id}]` : ''} "${text}"`;
    };
    const rect = (r: DOMRectReadOnly) =>
      `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        sources: {
          node: Node | null;
          previousRect: DOMRectReadOnly;
          currentRect: DOMRectReadOnly;
        }[];
      }[]) {
        w.__cls.total += entry.value;
        if (!entry.hadRecentInput) w.__cls.vitals += entry.value;
        w.__cls.shifts.push({
          value: entry.value,
          sources: entry.sources.map((s) => ({
            node: name(s.node),
            value: entry.value,
            from: rect(s.previousRect),
            to: rect(s.currentRect),
          })),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

export async function readCls(page: Page): Promise<Cls> {
  return page.evaluate(() => (window as unknown as { __cls: Cls }).__cls);
}

/** Start counting again. A test that checks every interaction on its own calls this between steps. */
export async function resetCls(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __cls: Cls };
    w.__cls.total = 0;
    w.__cls.vitals = 0;
    w.__cls.shifts = [];
  });
}
