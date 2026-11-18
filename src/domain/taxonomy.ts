import type { Tag } from '../api/types';
import type { TagModel } from './tags';

/** Areas that count for lists: the chosen ones, or all of them when nothing is chosen. */
export function effectiveAreas(model: TagModel, chosen: readonly number[]): Tag[] {
  const picked = model.areas.filter((area) => chosen.includes(area.id));
  return picked.length > 0 ? picked : model.areas;
}

/** Topics that belong to one of the areas. */
export function topicsIn(model: TagModel, areaIds: readonly number[]): Tag[] {
  return model.topics.filter((topic) => areaIds.includes(model.areaOf.get(topic.id) ?? -1));
}

/** Topic selections that still sit under a visible area. A hidden selection never filters. */
export function visibleSelection(
  model: TagModel,
  chosenAreas: readonly number[],
  chosenTopics: readonly number[],
): number[] {
  const visible = new Set(
    topicsIn(
      model,
      effectiveAreas(model, chosenAreas).map((area) => area.id),
    ).map((topic) => topic.id),
  );
  return chosenTopics.filter((id) => visible.has(id));
}

export const toggleId = (ids: readonly number[], id: number): number[] =>
  ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];

/**
 * Toggle a topic on a record. Paperless adds the ancestors of an assigned tag by itself,
 * so the same is done here and the list never disagrees with the server.
 */
export function withTopic(tags: readonly number[], model: TagModel, topicId: number): number[] {
  if (tags.includes(topicId)) return tags.filter((id) => id !== topicId);
  const area = model.areaOf.get(topicId);
  const parent = model.byId.get(topicId)?.parent;
  const extra = [area, parent].filter((id): id is number => id != null && !tags.includes(id));
  return [...new Set([...tags, topicId, ...extra])];
}

/** Toggle an area on a record. Removing an area removes its topics, or the server would add it back. */
export function withArea(tags: readonly number[], model: TagModel, areaId: number): number[] {
  if (!tags.includes(areaId)) return [...tags, areaId];
  const topicIds = topicsIn(model, [areaId]).map((topic) => topic.id);
  return tags.filter((id) => id !== areaId && !topicIds.includes(id));
}

/** Area and topic choices for intake: topics outside the chosen areas are dropped. */
export function intakeSelection(
  model: TagModel,
  areaIds: readonly number[],
  topicIds: readonly number[],
): number[] {
  const allowed = new Set(topicsIn(model, areaIds).map((topic) => topic.id));
  return [...areaIds, ...topicIds.filter((id) => allowed.has(id))];
}

export function selectionOf(model: TagModel, ids: readonly number[]): number[] {
  const known = new Set([...model.areas, ...model.topics].map((tag) => tag.id));
  return ids.filter((id) => known.has(id));
}
