import { getJson } from '../api/http';
import type { DetailedDoc } from '../domain/record-details';
import { appStore, persist } from './app';
let loading: Promise<void> | null = null;
export function loadSizes(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const docs = appStore.get().docs as DetailedDoc[];
    const missing = docs.filter((doc) => doc.size === undefined);
    const sizes = await Promise.all(
      missing.map(async (doc) => {
        try {
          const metadata = await getJson<{ original_size: number }>(
            `/api/documents/${doc.id}/metadata/`,
          );
          return [doc.id, metadata.original_size] as const;
        } catch {
          return [doc.id, null] as const;
        }
      }),
    );
    const byId = new Map(sizes);
    appStore.set((state) => ({
      docs: state.docs.map((doc) => (byId.has(doc.id) ? { ...doc, size: byId.get(doc.id) } : doc)),
    }));
    persist();
  })().finally(() => {
    loading = null;
  });
  return loading;
}
