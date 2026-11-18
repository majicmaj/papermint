import { GROUPING_OPTIONS } from '../domain/list-groups';
import { Icon } from '../icons/Icon';
import { setGrouping, useGrouping } from '../state/grouping';
import { Menu } from './Menu';

export function GroupMenu() {
  const grouping = useGrouping();
  return (
    <Menu label="Group" hostClass="group-host" triggerClass="chip" trigger="Group">
      {(close) =>
        GROUPING_OPTIONS.map(([key, name]) => (
          <button
            key={key}
            type="button"
            class="menu-item"
            role="menuitemradio"
            aria-checked={grouping === key}
            onClick={() => {
              close();
              setGrouping(key);
            }}
          >
            <span class="menu-check">{grouping === key && <Icon name="check" size={14} />}</span>
            {name}
          </button>
        ))
      }
    </Menu>
  );
}
