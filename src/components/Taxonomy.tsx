import { runtimeConfig } from '../config/runtime';
import './taxonomy.css';
import { useMemo } from 'preact/hooks';
import type { Tag } from '../api/types';
import { effectiveAreas, toggleId, topicsIn, visibleSelection } from '../domain/taxonomy';
import { Icon } from '../icons/Icon';
import { useApp } from '../state/app';
import { openTagEditor, openTagMenu, type TagKind } from '../state/tag-editor';
import { selectAreas, selectTopics, useTopics } from '../state/topics';
import { Glyph } from './Glyph';

/** Called before a menu or the editor opens from a row. A phone closes its Areas menu then. */
type Act = (() => void) | undefined;

interface RowProps {
  tag: Tag;
  onAct: Act;
  count: number;
  pressed: boolean;
  onToggle: () => void;
}

function TagRow({ tag, count, pressed, onToggle, onAct }: RowProps) {
  const openMenu = (x: number, y: number) => {
    if (runtimeConfig().readOnly) return;
    onAct?.();
    openTagMenu({ tagId: tag.id, x, y });
  };
  return (
    <div
      class="tag-row"
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu(event.clientX, event.clientY);
      }}
    >
      <button type="button" class="tag-toggle" aria-pressed={pressed} onClick={onToggle}>
        <Glyph tag={tag} />
        <span class="tag-name">{tag.name}</span>
        <span class="tag-count">{count}</span>
      </button>
      <button
        type="button"
        class="tag-more"
        disabled={runtimeConfig().readOnly}
        aria-label={`Edit ${tag.name}`}
        aria-haspopup="menu"
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          openMenu(box.left, box.bottom + 4);
        }}
      >
        <Icon name="ellipsis" />
      </button>
    </div>
  );
}

interface HeadProps {
  title: string;
  kind: TagKind;
  onNone: () => void;
  parent?: number | null;
  onAct: Act;
}

function Head({ title, kind, onNone, parent, onAct }: HeadProps) {
  return (
    <div class="tag-head">
      <span class="tag-head-title">{title}</span>
      <button type="button" class="tag-head-action" onClick={onNone}>
        Clear all
      </button>
      <button
        type="button"
        class="tag-head-add"
        disabled={runtimeConfig().readOnly}
        aria-label={`New ${kind}`}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          onAct?.();
          openTagEditor({ kind, parent: parent ?? null, x: box.left, y: box.bottom + 4 });
        }}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}

/** Areas, then the topics of the selected areas. Selection filters the lists; empty means all. */
export function Taxonomy({ onAct }: { onAct?: () => void }) {
  const { areas: chosenAreas, selected } = useTopics();
  const model = useApp((s) => s.model);
  const docs = useApp((s) => s.docs);
  const ready = useApp((s) => s.phase === 'ready');
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const doc of docs) for (const id of doc.tags) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, [docs]);
  const shown = effectiveAreas(model, chosenAreas);
  const groups = shown
    .map((area) => ({ area, topics: topicsIn(model, [area.id]) }))
    .filter((group) => group.topics.length > 0);
  const entries: ({ sub: string } | { tag: Tag })[] = groups.flatMap(({ area, topics }) => [
    ...(groups.length > 1 ? [{ sub: area.name }] : []),
    ...topics.map((tag) => ({ tag })),
  ]);
  const pickAreas = (next: number[]) => {
    selectAreas(next);
    selectTopics(visibleSelection(model, next, selected));
  };
  // Nothing until the tags are in: the sections then appear at once, at the end of the rail.
  if (!ready && model.areas.length === 0) return null;
  return (
    <div class="taxonomy">
      <Head title="Areas" kind="area" onAct={onAct} onNone={() => pickAreas([])} />
      {model.areas.map((tag) => (
        <TagRow
          key={tag.id}
          tag={tag}
          onAct={onAct}
          count={counts.get(tag.id) ?? 0}
          pressed={chosenAreas.includes(tag.id)}
          onToggle={() => pickAreas(toggleId(chosenAreas, tag.id))}
        />
      ))}
      <Head
        title="Topics"
        kind="topic"
        onAct={onAct}
        parent={shown.length === 1 ? shown[0]!.id : null}
        onNone={() => selectTopics([])}
      />
      {entries.map((entry, index) =>
        // Keyed by position: choosing areas swaps the content of the same rows in place, so
        // no row below moves. A subheader is as tall as a row for the same reason.
        'sub' in entry ? (
          <div key={index} class="tag-subhead">
            {entry.sub}
          </div>
        ) : (
          <TagRow
            key={index}
            tag={entry.tag}
            onAct={onAct}
            count={counts.get(entry.tag.id) ?? 0}
            pressed={selected.includes(entry.tag.id)}
            onToggle={() => selectTopics(toggleId(selected, entry.tag.id))}
          />
        ),
      )}
    </div>
  );
}
