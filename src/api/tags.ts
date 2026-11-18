import { patchJson, postJson } from './http';
import type { Tag } from './types';

export interface TagDraft {
  name: string;
  color: string;
  /** Area id for a topic, null for an area. */
  parent: number | null;
}

const FIELDS = (tag: Tag): Tag => ({
  id: tag.id,
  name: tag.name,
  slug: tag.slug,
  color: tag.color,
  parent: tag.parent ?? null,
  children: tag.children ?? [],
});

/** A new tag never matches documents by itself: matching_algorithm 0 is "none". */
export async function createTag(draft: TagDraft): Promise<Tag> {
  return FIELDS(
    await postJson<Tag>('/api/tags/', {
      name: draft.name,
      color: draft.color,
      parent: draft.parent,
      matching_algorithm: 0,
      is_inbox_tag: false,
    }),
  );
}

export async function updateTag(id: number, patch: Partial<TagDraft>): Promise<Tag> {
  return FIELDS(await patchJson<Tag>(`/api/tags/${id}/`, patch));
}
