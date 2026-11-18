import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A server that keeps one settings object, answers slowly, and replaces it whole on POST. */
function fakeServer(initial: Record<string, unknown> = {}) {
  let settings: Record<string, unknown> = initial;
  const calls: { method: string; cache?: RequestCache }[] = [];
  const answer = async (_url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, cache: init.cache });
    // Reads and writes both take a while, so another tab can slip in between them.
    await new Promise((r) => setTimeout(r, method === 'GET' ? 5 : 8));
    if (method === 'POST') {
      settings = (JSON.parse(String(init.body)) as { settings: Record<string, unknown> }).settings;
      return new Response('{}', { status: 200 });
    }
    return new Response(JSON.stringify({ settings }), { status: 200 });
  };
  return {
    answer,
    calls,
    icons: () => (settings['majin'] as { tagIcons: Record<string, string> }).tagIcons,
  };
}

/** The Web Locks API in miniature: one holder at a time per name, in order. */
function fakeLocks() {
  const tails = new Map<string, Promise<unknown>>();
  const requested: string[] = [];
  return {
    requested,
    request: <T>(name: string, run: () => Promise<T>): Promise<T> => {
      requested.push(name);
      const next = (tails.get(name) ?? Promise.resolve()).then(run, run);
      tails.set(
        name,
        next.catch(() => undefined),
      );
      return next;
    },
  };
}

async function freshTab() {
  vi.resetModules();
  return import('./ui-settings');
}

beforeEach(() => {
  vi.stubGlobal('document', { cookie: '' });
});
afterEach(() => vi.unstubAllGlobals());

describe('saving tag icons from two tabs', () => {
  it('keeps both icons when two tabs save at once, under one shared lock', async () => {
    const server = fakeServer();
    vi.stubGlobal('fetch', server.answer);
    vi.stubGlobal('navigator', { locks: fakeLocks() });
    const [tabA, tabB] = [await freshTab(), await freshTab()];
    await Promise.all([tabA.saveTagIcon(1, 'landmark'), tabB.saveTagIcon(2, 'file')]);
    expect(server.icons()).toEqual({ '1': 'landmark', '2': 'file' });
  });

  it('would lose one of them without the lock: this is what the lock is for', async () => {
    const server = fakeServer();
    vi.stubGlobal('fetch', server.answer);
    vi.stubGlobal('navigator', {});
    const [tabA, tabB] = [await freshTab(), await freshTab()];
    await Promise.all([tabA.saveTagIcon(1, 'landmark'), tabB.saveTagIcon(2, 'file')]);
    expect(Object.keys(server.icons())).toHaveLength(1);
  });

  it('takes the named lock around the read and the write together', async () => {
    const locks = fakeLocks();
    vi.stubGlobal('fetch', fakeServer().answer);
    vi.stubGlobal('navigator', { locks });
    const tab = await freshTab();
    await tab.saveTagIcon(1, 'landmark');
    expect(locks.requested).toEqual([tab.SETTINGS_LOCK]);
  });

  it('reads the settings it builds on from the network, never from a cache', async () => {
    const server = fakeServer({ other: 1 });
    vi.stubGlobal('fetch', server.answer);
    vi.stubGlobal('navigator', { locks: fakeLocks() });
    const tab = await freshTab();
    await tab.saveTagIcon(1, 'landmark');
    expect(server.calls).toEqual([
      { method: 'GET', cache: 'no-store' },
      { method: 'POST', cache: 'no-store' },
    ]);
  });

  it('changes only its own icon and keeps every other setting', async () => {
    const server = fakeServer({ other: 1, majin: { tagIcons: { '9': 'x' }, keep: true } });
    vi.stubGlobal('fetch', server.answer);
    vi.stubGlobal('navigator', { locks: fakeLocks() });
    const tab = await freshTab();
    const icons = await tab.saveTagIcon(1, 'landmark');
    expect(icons).toEqual({ '9': 'x', '1': 'landmark' });
    await tab.saveTagIcon(9, null);
    expect(server.icons()).toEqual({ '1': 'landmark' });
  });

  it('works where the Web Locks API does not exist', async () => {
    const server = fakeServer();
    vi.stubGlobal('fetch', server.answer);
    vi.stubGlobal('navigator', {});
    const tab = await freshTab();
    await tab.saveTagIcon(1, 'landmark');
    expect(server.icons()).toEqual({ '1': 'landmark' });
  });
});
