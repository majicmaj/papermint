import type { Tag } from '../api/types';
import { Icon } from '../icons/Icon';
import { toggleId } from '../domain/taxonomy';
import { Menu } from './Menu';
import { Glyph } from './Glyph';

interface Props {
  label: string;
  options: Tag[];
  value: number[];
  disabled?: boolean;
  onChange: (value: number[]) => void;
}

/** A field that lists its choices in a menu and keeps it open while the owner ticks several. */
export function MultiSelect({ label, options, value, disabled, onChange }: Props) {
  const chosen = options.filter((tag) => value.includes(tag.id));
  return (
    <Menu
      label={label}
      triggerClass="field field--menu"
      disabled={disabled}
      trigger={
        <>
          <span class={`field-text${chosen.length === 0 ? ' field--empty' : ''}`}>
            {chosen.length > 0 ? chosen.map((tag) => tag.name).join(', ') : label}
          </span>
          <Icon name="chevron_down" size={14} />
        </>
      }
    >
      {() =>
        options.map((tag) => {
          const on = value.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={on}
              class="menu-item"
              onClick={() => onChange(toggleId(value, tag.id))}
            >
              <span class="menu-check">{on && <Icon name="check" size={14} />}</span>
              <Glyph tag={tag} />
              {tag.name}
            </button>
          );
        })
      }
    </Menu>
  );
}
