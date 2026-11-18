import type { Tag } from '../api/types';

export function Dot({ color }: { color: string }) {
  return <span class="dot" style={{ background: color }} />;
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
  return (
    <span class="dots">
      {tags.slice(0, 2).map((tag) => (
        <span key={tag.id} title={tag.name}>
          <Dot color={tag.color} />
        </span>
      ))}
    </span>
  );
}
