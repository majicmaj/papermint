const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Format `YYYY-MM-DD` or an ISO timestamp. Date-only values never shift with the time zone. */
export function formatDate(value: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : DATE.format(date);
}

export type FileKind = 'pdf' | 'image' | 'text' | 'other';

/** Map a response Content-Type (without parameters) to a renderer. */
export function kindFromContentType(type: string): FileKind {
  return fileKind(type.split(';')[0]!.trim().toLowerCase());
}

export function fileKind(mime: string): FileKind {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('text/')) return 'text';
  return 'other';
}
