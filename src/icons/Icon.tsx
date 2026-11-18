import { ICONS, type IconName } from './paths';
import { TAG_ICONS, type TagIconName } from './tag-icons';

interface IconProps {
  name: IconName | TagIconName;
  size?: number;
}

const ALL: Record<string, string> = { ...ICONS, ...TAG_ICONS };

export function Icon({ name, size = 16 }: IconProps) {
  return (
    <svg
      class="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ALL[name] ?? '' }}
    />
  );
}
