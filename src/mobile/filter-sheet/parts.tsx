import type { ComponentChildren } from 'preact';
import { Icon } from '../../icons/Icon';
import type { IconName } from '../../icons/paths';
import type { TagIconName } from '../../icons/tag-icons';

type AnyIcon = IconName | TagIconName;

/** One inset grouped list. Rows inside it draw their own separators. */
export function Group({
  children,
  role,
  label,
}: {
  children: ComponentChildren;
  role?: 'radiogroup' | 'group';
  label?: string;
}) {
  return (
    <div class="fs-group" role={role} aria-label={label}>
      {children}
    </div>
  );
}

/** A muted section label above a group. */
export function Label({ children }: { children: ComponentChildren }) {
  return <h3 class="fs-label">{children}</h3>;
}

/** A row that opens a page: icon, label, the current value, a chevron. */
export function NavRow({
  icon,
  label,
  summary,
  kind,
  onOpen,
}: {
  icon: AnyIcon;
  label: string;
  summary: string;
  kind: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" class="fs-row fs-nav" data-kind={kind} onClick={onOpen}>
      <span class="fs-icon">
        <Icon name={icon} size={20} />
      </span>
      <span class="fs-text">{label}</span>
      <span class="fs-summary">{summary}</span>
      <span class="fs-chevron">
        <Icon name="chevron_right" size={18} />
      </span>
    </button>
  );
}

/** A row that is a switch. The whole row is its label, so the whole row toggles it. */
export function SwitchRow({
  icon,
  label,
  kind,
  checked,
  onChange,
}: {
  icon: AnyIcon;
  label: string;
  kind: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label class="fs-row fs-toggle" data-kind={kind}>
      <span class="fs-icon">
        <Icon name={icon} size={20} />
      </span>
      <span class="fs-text">{label}</span>
      <input
        class="fs-switch"
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

/** One choice of a single-choice list. The check is a fixed slot, so a choice moves nothing. */
export function ChoiceRow({
  label,
  checked,
  onChoose,
}: {
  label: string;
  checked: boolean;
  onChoose: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={checked} class="fs-row" onClick={onChoose}>
      <span class="fs-text">{label}</span>
      <span class="fs-mark">{checked && <Icon name="check" size={20} />}</span>
    </button>
  );
}

/** A labelled field row: the label on the left, the input on the right. */
export function FieldRow({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <label class="fs-row fs-field">
      <span class="fs-text">{label}</span>
      {children}
    </label>
  );
}

/** The mark of a multiple-choice row: a check when chosen, an empty fixed slot when not. */
export function Tick({ on }: { on: boolean }) {
  return (
    <span class="fs-tick" data-on={on ? 'true' : undefined}>
      {on && <Icon name="check" size={20} />}
    </span>
  );
}

/** A sub-page's header: Back, the title, one action at the end. */
export function PageHead({
  title,
  onBack,
  end,
}: {
  title: string;
  onBack: () => void;
  end?: ComponentChildren;
}) {
  return (
    <div class="fs-head fs-subhead">
      <button type="button" class="fs-round fs-back" aria-label="Back" onClick={onBack}>
        <Icon name="arrow_left" size={20} />
      </button>
      <h2 class="fs-title">{title}</h2>
      {end}
    </div>
  );
}
