import { withBase } from '../base';
import type { RecoveryFile } from '../config/config';
import { runtimeConfig } from '../config/runtime';

export type { RecoveryFile } from '../config/config';

export function recoveryFiles(): readonly RecoveryFile[] {
  return runtimeConfig().recoveryFiles;
}

export function recoveryFile(
  key: string,
  files: readonly RecoveryFile[] = recoveryFiles(),
): RecoveryFile | null {
  return files.find((file) => file.key === key) ?? null;
}

/** App route that opens the file in a pane. The download itself stays under a proxy route. */
export function filePath(key: string): string {
  return withBase(`/f/${encodeURIComponent(key)}`);
}
