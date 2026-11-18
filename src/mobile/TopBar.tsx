import type { FilterChip } from '../domain/filters';
import { VIEW_LABEL, type ViewName } from '../domain/views';
import { Icon } from '../icons/Icon';
import { HeaderMenu } from './HeaderMenu';

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
 * The phone header scrolls with the list and shows chips when filters are active.
 */
export function TopBar({ view, chips, active, expanded, onFilter, onRemove, ...more }: Props) {
  const list = view !== 'recovery';
  return (
    <header class="topbar">
      <div class="topbar-head">
        <h1 class="topbar-title">{VIEW_LABEL[view]}</h1>
        <HeaderMenu view={view} {...more} />
      </div>
      {list && (
        <div class="topbar-controls">
          <button
            type="button"
            class="topbar-filter"
            aria-haspopup="dialog"
            aria-expanded={expanded}
            data-active={active || chips.length > 0 ? 'true' : undefined}
            onClick={onFilter}
          >
            <Icon name="sliders_horizontal" size={18} />
            Filter
          </button>
        </div>
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
