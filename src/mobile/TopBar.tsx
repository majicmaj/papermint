import type { FilterChip } from '../domain/filters';
import { VIEW_LABEL, type ViewName } from '../domain/views';
import { Icon } from '../icons/Icon';
import { HeaderMenu } from './HeaderMenu';
import { Segments } from './Segments';

interface Props {
  view: ViewName;
  chips: FilterChip[];
  /** An area or a topic is chosen. The chips cannot show it, so the button does. */
  active: boolean;
  expanded: boolean;
  onFilter: () => void;
  onRemove: (chip: FilterChip) => void;
  superseded: boolean;
  onSuperseded: (value: boolean) => void;
}

/**
 * The phone's header. It scrolls with the list: a large title and `⋯`, the Current and Drafts
 * pills with the Filter button, and the active filters while there are any.
 */
export function TopBar({ view, chips, active, expanded, onFilter, onRemove, ...more }: Props) {
  const list = view !== 'recovery';
  return (
    <header class="topbar">
      <div class="topbar-head">
        <h1 class="topbar-title">{VIEW_LABEL[list ? 'records' : 'recovery']}</h1>
        <HeaderMenu view={view} {...more} />
      </div>
      {list && (
        <Segments
          key={view}
          view={view}
          active={active || chips.length > 0}
          expanded={expanded}
          onFilter={onFilter}
        />
      )}
      {list && chips.length > 0 && (
        <div class="chips topbar-chips">
          {chips.map((chip) => (
            <button
              key={chip.id}
              class="chip chip--active"
              type="button"
              aria-label={`Remove ${chip.label}`}
              onClick={() => onRemove(chip)}
            >
              {chip.label}
              <Icon name="x" size={14} />
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
