import { requireOnline } from '../pwa/connectivity';
import { csrfToken, getJson } from './http';
import type { Page, TaskInfo } from './types';

interface RawTask {
  status: string;
  related_document_ids?: number[];
}

/** POST one file to post_document. Resolves with the task id. Reports upload progress 0..1. */
export function uploadDocument(
  file: File,
  tagIds: number[],
  onProgress: (fraction: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      requireOnline();
    } catch (error) {
      return reject(error);
    }
    const form = new FormData();
    form.append('document', file, file.name);
    for (const id of tagIds) form.append('tags', String(id));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/documents/post_document/');
    xhr.setRequestHeader('Accept', 'application/json');
    const token = csrfToken();
    if (token) xhr.setRequestHeader('X-CSRFToken', token);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(String(JSON.parse(xhr.responseText)));
      } else {
        reject(new Error(`upload ${xhr.status}`));
      }
    };
    // A request that got no answer is a TypeError, like a failed fetch, so callers can tell it from a refusal.
    xhr.onerror = () => reject(new TypeError('upload failed'));
    xhr.send(form);
  });
}

export async function fetchTask(taskId: string, signal?: AbortSignal): Promise<TaskInfo | null> {
  const page = await getJson<Page<RawTask>>(
    `/api/tasks/?task_id=${encodeURIComponent(taskId)}`,
    signal,
  );
  const task = page.results[0];
  if (!task) return null;
  return { status: task.status, documentIds: task.related_document_ids ?? [] };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Poll until the task finishes. Resolves with the new document id, or null on failure. */
export async function waitForTask(taskId: string, signal?: AbortSignal): Promise<number | null> {
  for (let attempt = 0; attempt < 120; attempt++) {
    await sleep(attempt < 5 ? 600 : 1500);
    if (signal?.aborted) return null;
    const task = await fetchTask(taskId, signal).catch(() => null);
    if (task?.status === 'success') return task.documentIds[0] ?? null;
    if (task && (task.status === 'failure' || task.status === 'revoked')) return null;
  }
  return null;
}
