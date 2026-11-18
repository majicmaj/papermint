import type { Tag } from '../api/types';
import { useApp } from '../state/app';

/** A color mark. Areas are squares and topics are circles, so the two levels read apart. */
export function Dot({ color, area = false }: { color: string; area?: boolean }) {
  return <span class="dot" data-shape={area ? 'area' : undefined} style={{ background: color }} />;
}

/** True when the tag is an area (a top-level folder of topics). */
export function useIsArea(): (tag: Tag) => boolean {
  const areas = useApp((state) => state.model.areas);
  return (tag) => areas.some((area) => area.id === tag.id);
}

/** The record's topics by name, at most three. Wide lists show these in place of the dots. */
export function TopicLabels({ tags }: { tags: Tag[] }) {
  const isArea = useIsArea();
  return (
    <span class="topic-labels">
      {tags.slice(0, 3).map((tag) => (
        <span key={tag.id} class="topic-label">
          <Dot color={tag.color} area={isArea(tag)} />
          <span class="topic-label-name">{tag.name}</span>
        </span>
      ))}
    </span>
  );
}

export function StatusPill({ tag }: { tag: Tag | null }) {
  if (!tag) return null;
  return (
    <span class="pill">
      <Dot color={tag.color} />
      {tag.name}
    </span>
  );
}

export function TopicDots({ tags }: { tags: Tag[] }) {
  const isArea = useIsArea();
  return (
    <span class="dots">
      {tags.slice(0, 2).map((tag) => (
        <span key={tag.id} title={tag.name}>
          <Dot color={tag.color} area={isArea(tag)} />
        </span>
      ))}
    </span>
  );
}
