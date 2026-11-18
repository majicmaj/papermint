export interface Tag {
  id: number;
  name: string;
  slug: string;
  color: string;
  /** Parent tag id. Areas have none; a topic's parent is its area. */
  parent?: number | null;
  children?: number[];
}

export interface DocVersion {
  id: number;
  added: string;
  label: string | null;
  isRoot: boolean;
}

export interface Doc {
  id: number;
  title: string;
  tags: number[];
  created: string;
  added: string;
  pageCount: number | null;
  /** Mime type of the ROOT file, which is the oldest file. Never use it to pick a renderer. */
  mime: string;
  /** Newest first, in the order the API gives: index 0 is the current version. */
  versions: DocVersion[];
}

export interface Page<T> {
  count: number;
  next: string | null;
  results: T[];
}

export interface RawVersion {
  id: number;
  added: string;
  version_label: string | null;
  is_root: boolean;
}

export interface RawDoc {
  id: number;
  title: string;
  tags: number[];
  created: string;
  added: string;
  page_count: number | null;
  mime_type: string;
  versions?: RawVersion[];
}

export interface SearchHit {
  id: number;
  title: string;
  snippet: string;
}

export type TaskStatus = 'pending' | 'started' | 'success' | 'failure' | 'revoked' | string;

export interface TaskInfo {
  status: TaskStatus;
  documentIds: number[];
}
