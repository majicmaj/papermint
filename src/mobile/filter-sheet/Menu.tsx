import type { Filters } from '../../domain/filters';
import { SORTS, type SortProps } from '../../components/SortRows';
import { Icon } from '../../icons/Icon';
import {
  DESKTOP_MENU,
  isSwitch,
  searchMenu,
  summaryOf,
  type MenuItem,
  type PageKind,
  type SummaryContext,
} from '../rows';
import { FavoriteSection, SaveFavoriteRow, useFavoriteHits } from './FavoriteRows';
import { Group, Label, NavRow, SwitchRow } from './parts';
import { TagResults, hasTagHits, useChoice } from './TagPages';

interface HeadProps {
  query: string;
  onQuery: (query: string) => void;
  onClose?: () => void;
}

/** The menu's top row: the search field and the round close button. */
export function MenuHead({ query, onQuery, onClose }: HeadProps) {
  return (
    <div class="fs-head fs-top">
      <label class="fs-search">
        <Icon name="list_filter" size={20} />
        <input
          type="text"
          aria-label="Search filters"
          placeholder="Search filters"
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          enterKeyHint="search"
          data-popover-focus
          value={query}
          onInput={(event) => onQuery(event.currentTarget.value)}
        />
      </label>
      {onClose && (
        <button type="button" class="fs-round fs-close" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={22} />
        </button>
      )}
    </div>
  );
}

interface BodyProps extends SortProps {
  query: string;
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  today: Date;
  onOpen: (kind: PageKind) => void;
  desktop?: boolean;
  /** Closes the phone's sheet. The desktop Filter menu has none, and shows no favorites. */
  onClose?: () => void;
}

function useSummary(props: BodyProps): SummaryContext {
  const { model, areas, visible } = useChoice();
  const name = (id: number) => model.byId.get(id)?.name ?? '';
  return {
    filters: props.filters,
    sort: props.sort,
    sortLabel: SORTS.find(([key]) => key === props.sort)?.[1] ?? '',
    areaNames: areas.map(name).filter(Boolean),
    topicNames: visible.map(name).filter(Boolean),
    today: props.today,
  };
}

function Row({ item, props, ctx }: { item: MenuItem; props: BodyProps; ctx: SummaryContext }) {
  const { kind } = item;
  if (isSwitch(kind)) {
    return (
      <SwitchRow
        icon={item.icon}
        label={item.label}
        kind={kind}
        checked={props.filters[kind]}
        onChange={(value) => props.update({ [kind]: value })}
      />
    );
  }
  return (
    <NavRow
      icon={item.icon}
      label={item.label}
      kind={kind}
      summary={summaryOf(kind, ctx)}
      onOpen={() => props.onOpen(kind)}
    />
  );
}

/** Every filter kind in one grouped list; a search narrows it and adds matching areas and topics. */
export function MenuBody(props: BodyProps) {
  const ctx = useSummary(props);
  const { model } = useChoice();
  const items = searchMenu(props.query, props.desktop ? DESKTOP_MENU : undefined);
  const searching = props.query.trim() !== '';
  const phone = !props.desktop && props.onClose;
  const favoriteHits = useFavoriteHits(props.query) && !!phone;
  const empty = searching && items.length === 0 && !hasTagHits(model, props.query) && !favoriteHits;
  return (
    <>
      {phone && <FavoriteSection query={props.query} onClose={phone} />}
      {items.length > 0 && (
        <div class="fs-section">
          {(!props.desktop || searching) && <Label>{searching ? 'Filters' : 'All filters'}</Label>}
          <Group>
            {items.map((item) => (
              <Row key={item.kind} item={item} props={props} ctx={ctx} />
            ))}
          </Group>
        </div>
      )}
      {searching && <TagResults query={props.query} />}
      {phone && !searching && <SaveFavoriteRow onClose={phone} />}
      {empty && <p class="fs-empty">No matches</p>}
    </>
  );
}
