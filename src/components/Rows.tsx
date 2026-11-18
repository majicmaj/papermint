import './records.css';
import { SupersededBy, useLinks } from './SupersededBy';
import { sensitive, signed } from '../domain/record-details';
import type { Doc } from '../api/types';
import { formatDate } from '../domain/format';
import { areasOf, statusTag, topicsOf, type TagModel } from '../domain/tags';
import type { ViewName } from '../domain/views';
import { Icon } from '../icons/Icon';
import { useApp } from '../state/app';
import { navigate, recordPath } from '../state/router';
import { rowIntent } from '../pwa/prefetch';
import { TopicDots, StatusPill } from './Pill';

interface RowProps {
  doc: Doc;
  model: TagModel;
  view: ViewName;
  selectedId: number | null;
}

export function open(event: MouseEvent | KeyboardEvent, path: string, from: ViewName): void {
  if (
    'button' in event &&
    (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
  ) {
    return;
  }
  event.preventDefault();
  navigate(path, { from });
}

/** A row never changes height. Versions open in the record view, not in the list. */
export function Row({ doc, model, view, selectedId }: RowProps) {
  const path = recordPath(doc.id);
  const tags = useApp((state) => state.tags);
  const { successor } = useLinks(doc);
  const topics = topicsOf(doc, model);
  return (
    // A div, not a link: the successor is a link of its own, and a link cannot hold a link.
    <div class="row-wrap">
      <div
        class="row"
        role="link"
        tabIndex={0}
        aria-current={selectedId === doc.id ? 'true' : undefined}
        data-id={doc.id}
        data-successor={successor ? '' : undefined}
        {...rowIntent(doc, tags)}
        onClick={(e) => open(e, path, view)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) open(e, path, view);
        }}
      >
        <span class="row-title">
          <span class="row-title-text">{doc.title}</span>
          {sensitive(doc, tags) && (
            <span class="row-mark" role="img" title="Sensitive" aria-label="Sensitive">
              <Icon name="lock" size={14} />
            </span>
          )}
          {signed(doc, tags) && (
            <span class="row-mark" role="img" title="Signed" aria-label="Signed">
              <Icon name="badge_check" size={14} />
            </span>
          )}
          <SupersededBy doc={doc} />
        </span>
        <span class="row-meta">
          <StatusPill tag={statusTag(doc, model)} />
          <span class="row-date">{formatDate(doc.created)}</span>
          <TopicDots tags={topics.length > 0 ? topics : areasOf(doc, model)} />
          {doc.versions.length > 1 && (
            <span class="row-versions" title="Versions">
              <Icon name="layers" size={12} />
              {doc.versions.length}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div class="row-wrap" key={i}>
          <div class="row" aria-hidden="true">
            <span class="skeleton-bar" style={{ width: `${48 + ((i * 17) % 38)}%`, height: 12 }} />
            <span class="skeleton-bar" style={{ width: '30%', height: 10 }} />
          </div>
        </div>
      ))}
    </>
  );
}
