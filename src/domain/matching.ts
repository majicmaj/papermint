import type { Tag } from '../api/types';
import { matchesFilters, type Filters } from './filters';
import { sensitive, signed, type DetailedDoc } from './record-details';
import { matchesTaxonomy, type TagModel } from './tags';
import { selectionOf, visibleSelection } from './taxonomy';
import { archiveRecords } from './views';

export interface RecordQuery {
  filters: Filters;
  /** The chosen areas and topics, as stored: unknown or hidden ones are ignored here. */
  areas: readonly number[];
  topics: readonly number[];
}

/** The Records list for a query, unsorted. The list and the favorite counts share this rule. */
export function recordsMatching<T extends DetailedDoc>(
  docs: readonly T[],
  model: TagModel,
  tags: readonly Tag[],
  { filters, areas, topics }: RecordQuery,
): T[] {
  const chosen = selectionOf(model, areas);
  const visible = visibleSelection(model, chosen, selectionOf(model, topics));
  const areaIds = new Set(model.areas.map((area) => area.id));
  return archiveRecords(docs, model, filters.superseded).filter(
    (doc) =>
      matchesTaxonomy(doc, chosen, visible) &&
      matchesFilters(doc, filters, {
        signed: filters.signed && signed(doc, tags),
        sensitive: filters.sensitive && sensitive(doc, tags),
        unfiled: filters.unfiled && !doc.tags.some((id) => areaIds.has(id)),
      }),
  );
}
