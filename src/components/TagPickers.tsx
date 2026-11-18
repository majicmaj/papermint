import { TAG_COLORS } from '../domain/tag-palette';
import { Icon } from '../icons/Icon';
import { TAG_ICON_NAMES } from '../icons/tag-icons';
import type { TagKind } from '../state/tag-editor';

const KINDS: { kind: TagKind; label: string }[] = [
  { kind: 'area', label: 'Area' },
  { kind: 'topic', label: 'Topic' },
];

export function KindPicker({
  kind,
  disabled,
  onChange,
}: {
  kind: TagKind;
  disabled: boolean;
  onChange: (kind: TagKind) => void;
}) {
  return (
    <div class="segmented" role="radiogroup" aria-label="Kind">
      {KINDS.map((item) => (
        <button
          key={item.kind}
          type="button"
          role="radio"
          aria-checked={item.kind === kind}
          disabled={disabled && item.kind !== kind}
          class="segment"
          onClick={() => onChange(item.kind)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Swatches({ color, onChange }: { color: string; onChange: (hex: string) => void }) {
  return (
    <div class="swatches" role="radiogroup" aria-label="Color">
      {TAG_COLORS.map((swatch) => (
        <button
          key={swatch.hex}
          type="button"
          role="radio"
          aria-label={swatch.name}
          aria-checked={swatch.hex === color.toLowerCase()}
          class="swatch"
          onClick={() => onChange(swatch.hex)}
        >
          <span class="swatch-fill" style={{ background: swatch.hex }} />
        </button>
      ))}
    </div>
  );
}

export function IconGrid({
  icon,
  color,
  onChange,
}: {
  icon: string | null;
  color: string;
  onChange: (icon: string | null) => void;
}) {
  return (
    <div class="icon-grid" role="group" aria-label="Icon">
      {TAG_ICON_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          aria-label={name}
          aria-pressed={name === icon}
          class="icon-cell"
          style={name === icon ? { color } : undefined}
          onClick={() => onChange(name === icon ? null : name)}
        >
          <Icon name={name} size={18} />
        </button>
      ))}
    </div>
  );
}
