export type RecoveryKind = 'text' | 'pdf' | 'archive';

export interface RecoveryFile {
  key: string;
  title: string;
  href: string;
  kind: RecoveryKind;
  label: string;
  filename: string;
}

export interface AppConfig {
  untaggedStatus: 'current' | 'draft';
  successorField: string;
  recoveryFiles: readonly RecoveryFile[];
}

export const DEFAULT_CONFIG: AppConfig = {
  untaggedStatus: 'current',
  successorField: 'Superseded by',
  recoveryFiles: [],
};

const RECOVERY_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Literal path segments only, so these stay under the protected, non-cached proxy routes.
const RECOVERY_PATH = /^\/(?:recovery|recovery-files|backups)(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/;

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function kindOf(value: unknown): RecoveryKind | null {
  return value === 'text' || value === 'pdf' || value === 'archive' ? value : null;
}

function validFilename(filename: string): boolean {
  if (!filename || filename === '.' || filename === '..' || /[/\\]/.test(filename)) {
    return false;
  }
  return [...filename].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127);
}

function parseRecoveryFile(value: unknown): RecoveryFile | null {
  const input = object(value);
  const key = string(input.key);
  const href = string(input.href);
  const title = string(input.title);
  const label = string(input.label);
  const filename = string(input.filename);
  const kind = kindOf(input.kind);
  if (!RECOVERY_KEY.test(key) || !RECOVERY_PATH.test(href) || !kind) return null;
  if (!title || !label || !validFilename(filename)) return null;
  return { key, href, title, label, filename, kind };
}

function parseRecoveryFiles(value: unknown): RecoveryFile[] {
  if (!Array.isArray(value)) return [];
  const files = new Map<string, RecoveryFile>();
  for (const input of value) {
    const file = parseRecoveryFile(input);
    if (file && !files.has(file.key)) files.set(file.key, file);
  }
  return [...files.values()];
}

/** Invalid or missing values fall back independently to documented defaults. */
export function parseConfig(value: unknown): AppConfig {
  const input = object(value);
  return {
    untaggedStatus: input.untaggedStatus === 'draft' ? 'draft' : DEFAULT_CONFIG.untaggedStatus,
    successorField: string(input.successorField) || DEFAULT_CONFIG.successorField,
    recoveryFiles: parseRecoveryFiles(input.recoveryFiles),
  };
}
