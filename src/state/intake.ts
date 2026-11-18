import type { DocumentPatch } from '../api/documents';
import { withStatus, type TagModel } from '../domain/tags';
import { intakeSelection } from '../domain/taxonomy';

/** What the owner decides when a file lands. */
export interface IntakeForm {
  title: string;
  statusId: number | null;
  /** At least one area. */
  areaIds: number[];
  /** Topics of the chosen areas. */
  topicIds: number[];
  /** Add the file as a new version of this record instead of keeping it as its own. */
  targetId: number | null;
}

export interface IntakeDeps {
  patch: (id: number, body: DocumentPatch) => Promise<void>;
  merge: (rootId: number, sourceId: number, label?: string) => Promise<void>;
}

export type IntakeResult = { kind: 'filed' } | { kind: 'merged'; rootId: number };

export function fileNameToTitle(name: string): string {
  return name.replace(/\.[^./\\]+$/, '').trim() || name;
}

/** Status replaces the status tag. The chosen areas and topics replace all earlier ones. */
export function intakeTags(
  current: readonly number[],
  form: IntakeForm,
  model: TagModel,
): number[] {
  let tags = [...current];
  if (form.statusId !== null) tags = withStatus(tags, model, form.statusId);
  const placed = new Set([...model.areas, ...model.topics].map((tag) => tag.id));
  const chosen = intakeSelection(model, form.areaIds, form.topicIds);
  const topicParents = chosen.flatMap((id) => model.byId.get(id)?.parent ?? []);
  return [...new Set([...tags.filter((id) => !placed.has(id)), ...chosen, ...topicParents])];
}

/**
 * File the uploaded document. With a target it is merged into that record as its
 * newest version, and nothing else is written to the new document: the record keeps
 * its own status, areas and topics. Without a target the document keeps its own record.
 */
export async function fileIntake(
  docId: number,
  currentTags: readonly number[],
  form: IntakeForm,
  model: TagModel,
  deps: IntakeDeps,
): Promise<IntakeResult> {
  const title = form.title.trim();
  if (form.targetId !== null && form.targetId !== docId) {
    await deps.merge(form.targetId, docId, title || undefined);
    return { kind: 'merged', rootId: form.targetId };
  }
  const body: DocumentPatch = { tags: intakeTags(currentTags, form, model) };
  if (title) body.title = title;
  await deps.patch(docId, body);
  return { kind: 'filed' };
}
