import type { Filters } from '../domain/filters';
import type { ViewName } from '../domain/views';
import type { SortProps } from '../components/SortRows';
import { Drawer } from './Drawer';
import { Sheet } from './filter-sheet/Sheet';

interface Props extends SortProps {
  open: boolean;
  onClose: () => void;
  view: ViewName;
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  mimes: string[];
}

/**
 * The phone's filter sheet: one menu of filter kinds, each opening a page in the same sheet. It
 * writes the same state as the desktop rail, Filter menu and Sort menu, so the list behind it
 * changes as the owner chooses. The sheet's body lives only while the sheet is open, so it opens
 * on the menu every time.
 */
export function FilterDrawer({ open, onClose, filters, update, mimes, ...rest }: Props) {
  const { sort, setSort, ascending, setAscending } = rest;
  return (
    <Drawer open={open} onClose={onClose} label="Filter" variant="filter">
      <Sheet
        filters={filters}
        update={update}
        mimes={mimes}
        onClose={onClose}
        sort={sort}
        setSort={setSort}
        ascending={ascending}
        setAscending={setAscending}
      />
    </Drawer>
  );
}
