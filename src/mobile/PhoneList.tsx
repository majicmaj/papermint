import type { Tag } from '../api/types';
import { open } from '../components/Rows';
import type { SortKey } from '../domain/filters';
import { sensitive, signed, type DetailedDoc } from '../domain/record-details';
import { areasOf, statusOf, topicsOf, type TagModel } from '../domain/tags';
import type { ViewName } from '../domain/views';
import { Icon } from '../icons/Icon';
import { isTagIcon } from '../icons/tag-icons';
import { rowIntent } from '../pwa/prefetch';
import { useApp } from '../state/app';
import { recordPath } from '../state/router';
import {
  dateFieldFor,
  listItems,
  shortDate,
  type DateField,
  type RecordGroup,
} from '../domain/list-groups';

/**
 * What the end of a row shows. The end is right-aligned, so other marks or another date give it
 * another left edge: such a row is drawn new, never moved.
 */
function endOf(doc: DetailedDoc, model: TagModel, tags: readonly Tag[], field: DateField) {
  const marks = [
    signed(doc, tags),
    sensitive(doc, tags),
    statusOf(doc, model) === 'superseded',
  ].map(Number);
  return `${marks.join('')}${doc.versions.length > 1 ? doc.versions.length : ''}|${shortDate(doc[field])}`;
}

/** The record's first topic, else its first area: the owner's icon in its color, or a dot. */
function RowGlyph({ tag }: { tag: Tag | undefined }) {
  // The whole map: a row keeps its node when its content changes, so the tag changes under it.
  const icons = useApp((state) => state.icons);
  if (!tag) return <span class="prow-glyph" />;
  const icon = icons[String(tag.id)];
  return (
    <span class="prow-glyph" style={{ color: tag.color }}>
      {isTagIcon(icon) ? <Icon name={icon} size={20} /> : <span class="prow-dot" />}
    </span>
  );
}

function Mark({ name, icon }: { name: string; icon: 'badge_check' | 'lock' | 'archive' }) {
  return (
    <span class="row-mark" role="img" title={name} aria-label={name}>
      <Icon name={icon} size={16} />
    </span>
  );
}

interface RowProps {
  doc: DetailedDoc;
  model: TagModel;
  view: ViewName;
  selected: boolean;
  field: DateField;
}

/** One line: what it is about, the title, the marks and the date. A row never changes height. */
function PhoneRow({ doc, model, view, selected, field }: RowProps) {
  const tags = useApp((state) => state.tags);
  const path = recordPath(doc.id);
  const superseded = statusOf(doc, model) === 'superseded';
  return (
    <div class="row-wrap prow-wrap">
      <div
        class="row prow"
        role="link"
        tabIndex={0}
        aria-current={selected ? 'true' : undefined}
        data-id={doc.id}
        data-superseded={superseded ? '' : undefined}
        {...rowIntent(doc, tags)}
        onClick={(e) => open(e, path, view)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) open(e, path, view);
        }}
      >
        <RowGlyph tag={topicsOf(doc, model)[0] ?? areasOf(doc, model)[0]} />
        <span class="row-title">{doc.title}</span>
        <span class="prow-end">
          {signed(doc, tags) && <Mark name="Signed" icon="badge_check" />}
          {sensitive(doc, tags) && <Mark name="Sensitive" icon="lock" />}
          {doc.versions.length > 1 && (
            <span class="row-versions" title="Versions">
              <Icon name="layers" size={16} />
              {doc.versions.length}
            </span>
          )}
          {superseded && <Mark name="Superseded" icon="archive" />}
          <span class="row-date">{shortDate(doc[field])}</span>
        </span>
      </div>
    </div>
  );
}

interface ListProps {
  groups: readonly RecordGroup[];
  model: TagModel;
  view: ViewName;
  sort: SortKey;
  selectedId: number | null;
  /** Changes when something above the list changes height: every item is drawn new. */
  band: string;
}

/**
 * The phone list: month headers over one-line rows. Each item is keyed by its offset (and a row
 * by its end). An item that stays where it was swaps its content in place; an item that would
 * land somewhere new is a new node. So a change of filter, sort or grouping redraws the list
 * without moving any box.
 */
export function PhoneList({ groups, model, view, sort, selectedId, band }: ListProps) {
  const tags = useApp((state) => state.tags);
  const field = dateFieldFor(sort);
  return (
    <>
      {listItems(groups).map((item) =>
        item.kind === 'head' ? (
          <h2 key={`${band}h${item.y}`} class="prow-head">
            {item.label}
          </h2>
        ) : (
          <PhoneRow
            key={`${band}r${item.y}:${endOf(item.doc, model, tags, field)}`}
            doc={item.doc}
            model={model}
            view={view}
            selected={selectedId === item.doc.id}
            field={field}
          />
        ),
      )}
    </>
  );
}

export function PhoneSkeleton({ count }: { count: number }) {
  return (
    <div class="prow-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div class="row prow" key={i} aria-hidden="true">
          <span class="skeleton-bar prow-glyph-bar" />
          <span class="skeleton-bar" style={{ width: `${44 + ((i * 17) % 36)}%`, height: 12 }} />
        </div>
      ))}
    </div>
  );
}
