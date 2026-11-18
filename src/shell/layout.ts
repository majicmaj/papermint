export const LAYOUT_KEY = 'majin.layout.v1';

export type Column = 'rail' | 'list';

export interface Layout {
  rail: number;
  list: number;
  /** The sidebar is folded away. The list column starts at the left edge. */
  collapsed: boolean;
}

export const DEFAULTS: Layout = { rail: 216, list: 440, collapsed: false };

export const LIMITS: Record<Column, { min: number; max: number }> = {
  rail: { min: 180, max: 320 },
  list: { min: 320, max: 720 },
};

/** The preview pane never gets narrower than this. */
export const PANE_MIN = 360;

/** Largest width a column may take now. The list also leaves room for the pane. */
export function maxWidth(column: Column, layout: Layout, viewport: number): number {
  const { min, max } = LIMITS[column];
  if (column === 'rail') return max;
  const rail = layout.collapsed ? 0 : layout.rail;
  return Math.max(min, Math.min(max, viewport - rail - PANE_MIN));
}

export function clampWidth(
  column: Column,
  value: number,
  layout: Layout = DEFAULTS,
  viewport = Number.POSITIVE_INFINITY,
): number {
  const { min } = LIMITS[column];
  return Math.round(Math.min(maxWidth(column, layout, viewport), Math.max(min, value)));
}

/** Read a saved layout. Anything missing or out of range falls back to the default or the limit. */
export function parseLayout(raw: string | null): Layout {
  try {
    const data = JSON.parse(raw ?? 'null') as
      (Partial<Record<Column, unknown>> & { collapsed?: unknown }) | null;
    const read = (column: Column) =>
      typeof data?.[column] === 'number' && Number.isFinite(data[column])
        ? Math.round(Math.min(LIMITS[column].max, Math.max(LIMITS[column].min, data[column])))
        : DEFAULTS[column];
    return { rail: read('rail'), list: read('list'), collapsed: data?.collapsed === true };
  } catch {
    return { ...DEFAULTS };
  }
}

export function serializeLayout(layout: Layout): string {
  return JSON.stringify({ rail: layout.rail, list: layout.list, collapsed: layout.collapsed });
}
