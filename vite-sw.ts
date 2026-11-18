import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { build, type Plugin, type ResolvedConfig } from 'vite';

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Every built file the worker keeps for offline use, and an id that changes with any of them. */
export function precacheList(outDir: string): { entries: { url: string }[]; id: string } {
  const files = walk(outDir)
    .map((file) => relative(outDir, file))
    .filter((file) => file !== 'sw.js' && file !== 'config.json' && !file.endsWith('.map'))
    .sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)));
  return {
    entries: files.map((file) => ({ url: `/${file}` })),
    id: hash.digest('hex').slice(0, 12),
  };
}

/**
 * Build src/pwa/sw.ts as a plain script at /sw.js once the app is built. It cannot share
 * chunks with the app, and it must keep one stable name so browsers find updates to it.
 */
export function serviceWorker(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'papermint-service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    async closeBundle() {
      const outDir = resolve(config.root, config.build.outDir);
      const { entries, id } = precacheList(outDir);
      await build({
        configFile: false,
        logLevel: 'warn',
        root: config.root,
        publicDir: false,
        define: { __PRECACHE__: JSON.stringify(entries), __BUILD_ID__: JSON.stringify(id) },
        build: {
          outDir,
          emptyOutDir: false,
          minify: true,
          target: 'es2022',
          lib: {
            entry: resolve(config.root, 'src/pwa/sw.ts'),
            formats: ['iife'],
            name: 'papermintSw',
            fileName: () => 'sw.js',
          },
        },
      });
    },
  };
}
