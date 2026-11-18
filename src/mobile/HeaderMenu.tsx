import { recoveryFiles } from '../shell/recovery-files';
import { Menu } from '../components/Menu';
import { VIEW_LABEL, VIEW_PATH, type ViewName } from '../domain/views';
import { Icon } from '../icons/Icon';
import { navigate } from '../state/router';

interface Props {
  view: ViewName;
  superseded: boolean;
  onSuperseded: (value: boolean) => void;
}

/** The header's `⋯`: Recovery (Records from Recovery) and the Superseded switch. */
export function HeaderMenu({ view, superseded, onSuperseded }: Props) {
  const target: ViewName = view === 'recovery' ? 'records' : 'recovery';
  return (
    <Menu
      label="More"
      triggerClass="topbar-more"
      hostClass="topbar-menu"
      trigger={<Icon name="ellipsis" size={22} />}
    >
      {(close) => (
        <>
          {recoveryFiles().length > 0 && (
            <a
              class="menu-item"
              role="menuitem"
              href={VIEW_PATH[target]}
              onClick={(event) => {
                event.preventDefault();
                close();
                navigate(VIEW_PATH[target]);
              }}
            >
              <span class="menu-icon">
                <Icon name={target === 'recovery' ? 'life_buoy' : 'files'} size={18} />
              </span>
              {VIEW_LABEL[target]}
            </a>
          )}
          <button
            type="button"
            class="menu-item"
            role="menuitemcheckbox"
            aria-checked={superseded}
            onClick={() => onSuperseded(!superseded)}
          >
            <span class="menu-icon">
              <Icon name="archive" size={18} />
            </span>
            Superseded
            <span class="menu-switch" aria-hidden="true" />
          </button>
        </>
      )}
    </Menu>
  );
}
