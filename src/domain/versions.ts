import type { Doc, DocVersion } from '../api/types';
import { formatDate } from './format';

/**
 * Paperless orders `versions` newest first by version_index, then id. Index 0 is the
 * current version: the file that preview and download serve when no `version` is given.
 * Do not sort by `added`: a document can be merged in as a version.
 */
export function currentVersion(doc: Doc): DocVersion | null {
  return doc.versions[0] ?? null;
}

export function currentVersionId(doc: Doc): number {
  return currentVersion(doc)?.id ?? doc.id;
}

export type Resolved =
  { state: 'ok'; id: number; explicit: boolean } | { state: 'invalid'; requested: number };

/**
 * No `v` means the current version. An explicit `v` that is not a version of this
 * record is invalid: it must never fall back to another file.
 */
export function resolveVersion(doc: Doc, routeVersion: number | null): Resolved {
  if (routeVersion === null) return { state: 'ok', id: currentVersionId(doc), explicit: false };
  if (doc.versions.some((v) => v.id === routeVersion)) {
    return { state: 'ok', id: routeVersion, explicit: true };
  }
  return { state: 'invalid', requested: routeVersion };
}

/** The version id for a route that resolved. Falls back to the current one only for menus. */
export function selectedVersionId(doc: Doc, routeVersion: number | null): number {
  const resolved = resolveVersion(doc, routeVersion);
  return resolved.state === 'ok' ? resolved.id : currentVersionId(doc);
}

export function isCurrent(doc: Doc, routeVersion: number | null): boolean {
  return selectedVersionId(doc, routeVersion) === currentVersionId(doc);
}

export function versionName(version: DocVersion): string {
  return version.label?.trim() || formatDate(version.added);
}

export function findVersion(doc: Doc, versionId: number): DocVersion | null {
  return doc.versions.find((v) => v.id === versionId) ?? null;
}
