import { runtimeConfig } from '../config/runtime';
import type { Doc } from '../api/types';
import type { TagModel } from './tags';

export type ViewName = 'records' | 'recovery';

export const VIEW_LABEL: Record<ViewName, string> = {
  records: 'Records',
  recovery: 'Recovery',
};

export const VIEW_PATH: Record<ViewName, string> = {
  records: '/',
  recovery: '/recovery',
};

/** Recovery entries come from configuration, not tagged Paperless documents. */
export function visibleViews(): readonly ViewName[] {
  return runtimeConfig().recoveryFiles.length > 0 ? ['records', 'recovery'] : ['records'];
}

export function archiveRecords<T extends Doc>(
  docs: readonly T[],
  model: TagModel,
  includeSuperseded = false,
): readonly T[] {
  if (includeSuperseded) return docs;
  return docs.filter((doc) => !doc.tags.some((id) => model.statusKey.get(id) === 'superseded'));
}
