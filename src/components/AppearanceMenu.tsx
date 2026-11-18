import { Icon } from '../icons/Icon';
import { APPEARANCES, setAppearance, useAppearance } from '../shell/appearance';
import { Menu } from './Menu';

export function AppearanceItems({ close }: { close: () => void }) {
  const active = useAppearance();
  return (
    <>
      {APPEARANCES.map(([value, label, icon]) => (
        <button
          key={value}
          class="menu-item appearance-option"
          type="button"
          role="menuitemradio"
          aria-checked={active === value}
          onClick={() => {
            close();
            setAppearance(value);
          }}
        >
          <Icon name={icon} size={16} />
          <span>{label}</span>
          {active === value && <Icon name="check" size={14} />}
        </button>
      ))}
    </>
  );
}

export function AppearanceMenu() {
  const active = useAppearance();
  const icon = APPEARANCES.find(([value]) => value === active)?.[2] ?? 'monitor';
  return (
    <Menu
      label="Appearance"
      hostClass="appearance-host"
      triggerClass="btn btn--icon btn--ghost"
      trigger={<Icon name={icon} size={16} />}
    >
      {(close) => <AppearanceItems close={close} />}
    </Menu>
  );
}
