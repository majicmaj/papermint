import { runtimeConfig } from '../config/runtime';
import { getJson, patchJson, toLocalPath } from '../api/http';
import type { Doc, Page, Tag } from '../api/types';
import type { CustomValue, DetailedDoc } from '../domain/record-details';

interface RawDetails {
  id: number;
  modified: string;
  custom_fields: CustomValue[];
}
interface Field {
  id: number;
  name: string;
  data_type: string;
}
export async function fetchDetails(
  docs: Doc[],
): Promise<{ docs: DetailedDoc[]; fieldId: number | null }> {
  const [fields, details] = await Promise.all([
    getJson<Page<Field>>('/api/custom_fields/?page_size=200'),
    fetchAll(),
  ]);
  const fieldName = runtimeConfig().successorField.toLowerCase();
  const fieldId =
    fields.results.find(
      (field) =>
        field.name.trim().toLowerCase() === fieldName && field.data_type === 'documentlink',
    )?.id ?? null;
  const byId = new Map(details.map((detail) => [detail.id, detail]));
  return {
    fieldId,
    docs: docs.map((doc) => {
      const detail = byId.get(doc.id);
      return { ...doc, modified: detail?.modified, customFields: detail?.custom_fields ?? [] };
    }),
  };
}
async function fetchAll(): Promise<RawDetails[]> {
  let path: string | null = '/api/documents/?page_size=200&fields=id,modified,custom_fields';
  const all: RawDetails[] = [];
  while (path) {
    const page: Page<RawDetails> = await getJson(path);
    all.push(...page.results);
    path = page.next ? toLocalPath(page.next) : null;
  }
  return all;
}
export async function saveRecord(
  id: number,
  tags: number[],
  customFields: CustomValue[],
): Promise<void> {
  await patchJson(`/api/documents/${id}/`, { tags, custom_fields: customFields });
}

export async function fetchHierarchy(): Promise<Tag[]> {
  const tags: Tag[] = [];
  let path: string | null = '/api/tags/?page_size=200&fields=id,name,slug,color,parent,children';
  while (path) {
    const page: Page<Tag> = await getJson(path);
    tags.push(...page.results);
    path = page.next ? toLocalPath(page.next) : null;
  }
  return tags;
}
