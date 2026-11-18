import { useRef } from 'preact/hooks';
import { RecordPane } from '../components/RecordPane';
import { VIEW_PATH, type ViewName } from '../domain/views';
import { navigate, type Route } from '../state/router';
import { Drawer } from './Drawer';

/**
 * The record on a phone: a sheet over the list. The list stays mounted behind it, so closing the
 * sheet by a drag, a tap on the scrim, Escape or Back lands on the same scroll position. While the
 * sheet leaves, it keeps the record it showed.
 */
export function RecordSheet({ route, view }: { route: Route; view: ViewName }) {
  const open = route.name === 'record' || route.name === 'file';
  const last = useRef<Route>(route);
  if (open) last.current = route;
  return (
    <Drawer open={open} onClose={() => navigate(VIEW_PATH[view])} label="Record" variant="record">
      <RecordPane route={last.current} />
    </Drawer>
  );
}
