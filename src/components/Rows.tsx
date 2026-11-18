import './records.css';
import { SupersededBy } from './SupersededBy';
import { sensitive } from '../domain/record-details';
import type { DetailedDoc } from '../domain/record-details';
import { shortDate, type DateField } from '../domain/list-groups';
import { formatDate } from '../domain/format';
import { areasOf, statusTag, topicsOf, type TagModel } from '../domain/tags';
import type { ViewName } from '../domain/views';
import { Icon } from '../icons/Icon';
import { useApp } from '../state/app';
import { navigate, recordPath } from '../state/router';
import { rowIntent } from '../pwa/prefetch';
import { TopicDots, StatusPill } from './Pill';
import { Badges } from './RecordMarks';

interface RowProps {
  doc: DetailedDoc;
  model: TagModel;
  view: ViewName;
  selectedId: number | null;
  field: DateField;
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

/** A compact row with the title first and a trailing, aligned date. */
export function Row({ doc, model, view, selectedId, field }: RowProps) {
  const path = recordPath(doc.id);
  const tags = useApp((state) => state.tags);
  const status = statusTag(doc, model);
  const superseded = status !== null && model.statusKey.get(status.id) === 'superseded';
  const topics = topicsOf(doc, model);
  // Keep the focusable row mounted. Its cells are redrawn at the split pane's width.
  const layout = selectedId === null ? 'wide' : 'split';
  return (
    // The successor is a link of its own, and an anchor cannot contain another anchor.
    <div class="row-wrap">
      <div
        class="row archive-row"
        role="link"
        tabIndex={0}
        aria-current={selectedId === doc.id ? 'true' : undefined}
        data-id={doc.id}
        data-superseded={superseded ? '' : undefined}
        {...rowIntent(doc, tags)}
        onClick={(e) => open(e, path, view)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) open(e, path, view);
        }}
      >
        <span class="row-title" key={`${layout}-title`}>
          <span class="row-title-text" title={sensitive(doc, tags) ? undefined : doc.title}>
            {doc.title}
          </span>
          <Badges doc={doc} />
        </span>
        <span class="row-meta" key={`${layout}-meta`}>
          {superseded ? (
            <>
              <StatusPill tag={status} />
              <SupersededBy doc={doc} />
            </>
          ) : (
            <TopicDots tags={topics.length > 0 ? topics : areasOf(doc, model)} />
          )}
          {doc.versions.length > 1 && (
            <span class="row-versions" title="Versions">
              <Icon name="layers" size={12} />
              {doc.versions.length}
            </span>
          )}
        </span>
        <span class="row-date" key={`${layout}-date`} title={formatDate(doc[field] ?? '')}>
          {shortDate(doc[field])}
        </span>
      </div>
    </div>
  );
}

export function SkeletonRows({ layout }: { layout: string }) {
  return (
    <>
      {Array.from(layout, (item, i) =>
        item === 'h' ? (
          <div class="record-month" key={i} aria-hidden="true">
            <span class="skeleton-bar" style={{ width: 86, height: 9 }} />
          </div>
        ) : (
          <div class="row-wrap" key={i}>
            <div class="row archive-row" aria-hidden="true">
              <span
                class="skeleton-bar"
                style={{ width: `${40 + ((i * 17) % 40)}%`, height: 11 }}
              />
              <span />
              <span class="skeleton-bar" style={{ width: 34, height: 9, justifySelf: 'end' }} />
            </div>
          </div>
        ),
      )}
    </>
  );
}
