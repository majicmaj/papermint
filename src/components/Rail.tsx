import { withBase } from '../base';
import { runtimeConfig } from '../config/runtime';
import { RailBar } from '../shell/RailBar';
import { Favorites } from './Favorites';
import { Taxonomy } from './Taxonomy';
import {
  VIEW_LABEL,
  VIEW_PATH,
  archiveRecords,
  visibleViews,
  type ViewName,
} from '../domain/views';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/paths';
import { openPalette, pickFiles } from '../state/actions';
import { useApp } from '../state/app';
import { navigate } from '../state/router';

export const VIEW_ICON: Record<ViewName, IconName> = {
  records: 'files',
  recovery: 'life_buoy',
};

export function Brand() {
  return (
    <div class="brand">
      <img class="brand-mark" src={withBase('/favicon.png')} width="24" height="24" alt="" />
      <span class="brand-name">Papermint</span>
    </div>
  );
}

function NavLink({ view, active }: { view: ViewName; active: ViewName }) {
  const docs = useApp((s) => s.docs);
  const model = useApp((s) => s.model);
  const count = view === 'recovery' ? 0 : archiveRecords(docs, model).length;
  return (
    <a
      class="nav-item"
      href={VIEW_PATH[view]}
      aria-current={view === active ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(VIEW_PATH[view]);
      }}
    >
      <Icon name={VIEW_ICON[view]} />
      <span class="nav-label">{VIEW_LABEL[view]}</span>
      <span class="nav-count">{count > 0 ? count : ''}</span>
    </a>
  );
}

export function Rail({ active }: { active: ViewName }) {
  return (
    <aside class="rail">
      <RailBar />
      <div class="rail-body">
        <button type="button" class="search-field" onClick={() => openPalette()}>
          <Icon name="search" />
          <span class="search-label">Search</span>
          <kbd>⌘K</kbd>
        </button>
        <nav class="nav">
          {visibleViews().map((view) => (
            <NavLink key={view} view={view} active={active} />
          ))}
        </nav>
        <section class="rail-topics">
          <Favorites />
          <Taxonomy />
        </section>
        <div class="rail-foot">
          <button
            type="button"
            class="btn btn--ghost btn--block"
            disabled={runtimeConfig().readOnly}
            onClick={pickFiles}
          >
            <Icon name="upload" />
            Upload
          </button>
        </div>
      </div>
    </aside>
  );
}
