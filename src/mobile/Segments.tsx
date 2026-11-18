import { VIEW_PATH, type ViewName } from '../domain/views';
import { Icon } from '../icons/Icon';
import { navigate } from '../state/router';

const SEGMENTS: { view: ViewName; label: string }[] = [
  { view: 'records', label: 'Current' },
  { view: 'pending', label: 'Drafts' },
];

function go(event: MouseEvent, view: ViewName): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  navigate(VIEW_PATH[view]);
}

interface Props {
  view: ViewName;
  /** An area, a topic or a filter is chosen. */
  active: boolean;
  expanded: boolean;
  onFilter: () => void;
}

/**
 * Current and Drafts as pills under the title. The active pill holds the Filter button. The
 * owner keys this row by view, so a switch draws it new: the pills never slide sideways.
 */
export function Segments({ view, active, expanded, onFilter }: Props) {
  return (
    <nav class="segments" aria-label="Views">
      {SEGMENTS.map((segment) =>
        segment.view === view ? (
          <div key={segment.view} class="segment" data-active="true">
            <a
              class="segment-link"
              href={VIEW_PATH[segment.view]}
              aria-current="page"
              onClick={(event) => go(event, segment.view)}
            >
              {segment.label}
            </a>
            <span class="segment-divider" />
            <button
              type="button"
              class="topbar-filter"
              aria-label="Filter"
              aria-haspopup="dialog"
              aria-expanded={expanded}
              data-active={active ? 'true' : undefined}
              onClick={onFilter}
            >
              <Icon name="sliders_horizontal" size={18} />
            </button>
          </div>
        ) : (
          <a
            key={segment.view}
            class="segment segment-link"
            href={VIEW_PATH[segment.view]}
            onClick={(event) => go(event, segment.view)}
          >
            {segment.label}
          </a>
        ),
      )}
    </nav>
  );
}
