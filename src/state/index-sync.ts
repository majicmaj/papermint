import type { Doc, Tag } from '../api/types';

export interface Index {
  docs: Doc[];
  tags: Tag[];
}

const byId = <T extends { id: number }>(a: T, b: T) => a.id - b.id;

/** True when two indexes would draw the same lists. API order does not matter. */
export function sameIndex(a: Index, b: Index): boolean {
  if (a.docs.length !== b.docs.length || a.tags.length !== b.tags.length) return false;
  const docs = (index: Index) => JSON.stringify([...index.docs].sort(byId));
  const tags = (index: Index) => JSON.stringify([...index.tags].sort(byId));
  return docs(a) === docs(b) && tags(a) === tags(b);
}
