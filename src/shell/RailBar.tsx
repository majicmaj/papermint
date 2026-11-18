import { Icon } from '../icons/Icon';
import { toggleRail, useLayout } from './layout-store';
import { SyncDot } from './SyncDot';

/**
 * The sidebar's cell of the toolbar: room for the window controls in an installed window,
 * then the button that folds the sidebar away. Empty space here drags the window.
 */
export function RailBar() {
  const { collapsed } = useLayout();
  return (
    <div class="rail-bar">
      <button
        type="button"
        class="btn btn--icon btn--ghost"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        onClick={toggleRail}
      >
        <Icon name="panel_left" />
      </button>
      <SyncDot />
    </div>
  );
}
