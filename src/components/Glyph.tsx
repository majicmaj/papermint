import type { Tag } from '../api/types';
import { Icon } from '../icons/Icon';
import { isTagIcon } from '../icons/tag-icons';
import { useApp } from '../state/app';
import { Dot } from './Pill';

/** The owner's icon for a tag, or its color dot. Always a 16px slot, so nothing moves when it changes. */
export function Glyph({ tag, icon }: { tag: Tag; icon?: string | null }) {
  const stored = useApp((state) => state.icons[String(tag.id)]);
  const name = icon === undefined ? stored : (icon ?? undefined);
  return (
    <span class="glyph" style={{ color: tag.color }}>
      {isTagIcon(name) ? <Icon name={name} size={16} /> : <Dot color={tag.color} />}
    </span>
  );
}
