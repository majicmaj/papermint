import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { trackCls } from './cls';
import { mockApi, type Api, type MockDoc } from './fixture';
import { waitForRows } from './helpers';

/** The mocked archive plus filler records, so the list is long enough to scroll on a phone. */
export async function bootLong(page: Page, extra = 24, path = '/'): Promise<Api> {
  await trackCls(page);
  const api = await mockApi(page);
  for (let i = 0; i < extra; i++) {
    const day = String((i % 27) + 1).padStart(2, '0');
    const doc: MockDoc = {
      id: 300 + i,
      title: `Filler record ${String(i).padStart(2, '0')}`,
      tags: [2, 10],
      created: `2025-01-${day}`,
      added: `2025-01-${day}T10:00:00Z`,
      modified: `2025-01-${day}T11:00:00Z`,
      page_count: 1,
      mime_type: 'application/pdf',
      versions: [
        { id: 300 + i, added: `2025-01-${day}T10:00:00Z`, version_label: null, is_root: true },
      ],
      custom_fields: [],
    };
    api.docs.push(doc);
  }
  await page.goto(path);
  if (path.startsWith('/r/')) await expect(page.locator('.pane-title h1')).toBeVisible();
  else await waitForRows(page);
  return api;
}

/**
 * Record every animation that runs, from now on: CSS transitions and animations, WAAPI, and the
 * View Transition pseudo-elements. Each entry names what moved and which properties it changes.
 */
export async function recordAnimations(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen = new Set<string>();
    (window as unknown as { __anims: Set<string> }).__anims = seen;
    const describe = (animation: Animation): string => {
      const effect = animation.effect as KeyframeEffect | null;
      const target = effect?.target as HTMLElement | null;
      const pseudo = effect?.pseudoElement ?? '';
      const name =
        animation instanceof CSSTransition
          ? `transition:${animation.transitionProperty}`
          : animation instanceof CSSAnimation
            ? `animation:${animation.animationName}`
            : 'waapi';
      const props = new Set<string>();
      for (const frame of effect?.getKeyframes() ?? []) {
        for (const key of Object.keys(frame)) {
          if (!['offset', 'easing', 'composite', 'computedOffset'].includes(key)) props.add(key);
        }
      }
      const where = pseudo || `${target?.tagName.toLowerCase()}.${target?.className ?? ''}`;
      return `${where} ${name} [${[...props].join(',')}]`;
    };
    const sample = () => {
      for (const animation of document.getAnimations()) seen.add(describe(animation));
    };
    const tick = () => {
      sample();
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export const animationsSeen = (page: Page): Promise<string[]> =>
  page.evaluate(() => [...(window as unknown as { __anims: Set<string> }).__anims]);

export const anyAnimation = (seen: string[], match: string | RegExp) =>
  seen.some((s) => (typeof match === 'string' ? s.includes(match) : match.test(s)));

/** A real touch drag, sent to the browser as touch events. */
export async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  dy: number,
  ms: number,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', y?: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: y === undefined ? [] : [{ x: from.x, y }],
    });
  await send('touchStart', from.y);
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await send('touchMove', from.y + (dy * i) / steps);
    await page.waitForTimeout(ms / steps);
  }
  await send('touchEnd');
  await cdp.detach();
}

export async function center(target: Locator): Promise<{ x: number; y: number }> {
  const box = (await target.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export const onlyMobile = (info: TestInfo) => info.project.name === 'mobile';
