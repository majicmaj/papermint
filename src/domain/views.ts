import type { AppConfig } from '../config/config';
import { runtimeConfig } from '../config/runtime';
import type { Doc } from '../api/types';
import { statusOf, topicsOf, type TagModel } from './tags';

export type ViewName = 'records' | 'pending' | 'recovery';

export const VIEWS: readonly ViewName[] = ['records', 'pending', 'recovery'];

export const VIEW_LABEL: Record<ViewName, string> = {
  records: 'Records',
  pending: 'Drafts',
  recovery: 'Recovery',
};

export const VIEW_PATH: Record<ViewName, string> = {
  records: '/',
  pending: '/pending',
  recovery: '/recovery',
};

/** Recovery entries come from configuration, not tagged Paperless documents. */
export function visibleViews(): readonly ViewName[] {
  return runtimeConfig().recoveryFiles.length > 0 ? VIEWS : ['records', 'pending'];
}

type UntaggedStatus = AppConfig['untaggedStatus'];

export function viewFor(
  doc: Doc,
  model: TagModel,
  untaggedStatus: UntaggedStatus = runtimeConfig().untaggedStatus,
): ViewName {
  const status = statusOf(doc, model) ?? untaggedStatus;
  return status === 'draft' ? 'pending' : 'records';
}

function inView(
  doc: Doc,
  view: ViewName,
  model: TagModel,
  untaggedStatus: UntaggedStatus,
): boolean {
  const status = statusOf(doc, model) ?? untaggedStatus;
  return (view === 'records' && status === 'current') || (view === 'pending' && status === 'draft');
}

const byCreated = (a: Doc, b: Doc) => b.created.localeCompare(a.created) || b.id - a.id;
const byAdded = (a: Doc, b: Doc) => b.added.localeCompare(a.added) || b.id - a.id;

export function listView(
  docs: readonly Doc[],
  view: ViewName,
  model: TagModel,
  topicId: number | null,
  untaggedStatus: UntaggedStatus = runtimeConfig().untaggedStatus,
): Doc[] {
  const rows = docs.filter((doc) => {
    if (!inView(doc, view, model, untaggedStatus)) return false;
    return topicId === null || topicsOf(doc, model).some((t) => t.id === topicId);
  });
  return rows.sort(view === 'pending' ? byAdded : byCreated);
}

export function viewCount(
  docs: readonly Doc[],
  view: ViewName,
  model: TagModel,
  untaggedStatus: UntaggedStatus = runtimeConfig().untaggedStatus,
): number {
  return docs.filter((doc) => inView(doc, view, model, untaggedStatus)).length;
}
