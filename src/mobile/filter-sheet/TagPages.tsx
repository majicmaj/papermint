import { useMemo } from 'preact/hooks';
import type { Tag } from '../../api/types';
import { Glyph } from '../../components/Glyph';
import { effectiveAreas, toggleId, topicsIn, visibleSelection } from '../../domain/taxonomy';
import type { TagModel } from '../../domain/tags';
import { Icon } from '../../icons/Icon';
import { useApp } from '../../state/app';
import { openTagEditor, openTagMenu, type TagKind } from '../../state/tag-editor';
import { selectAreas, selectTopics, useTopics } from '../../state/topics';
import { searchNames } from '../rows';
import { Group, Label, PageHead, Tick } from './parts';

/** Runs before a tag menu or the tag editor opens: they live in the page, so the sheet closes. */
type Leave = () => void;

function useCounts(): Map<number, number> {
  const docs = useApp((s) => s.docs);
  return useMemo(() => {
    const map = new Map<number, number>();
    for (const doc of docs) for (const id of doc.tags) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, [docs]);
}

/** The chosen areas and topics, and the moves the sheet makes on them. */
export function useChoice() {
  const { areas, selected } = useTopics();
  const model = useApp((s) => s.model);
  const visible = visibleSelection(model, areas, selected);
  const pickAreas = (next: number[]) => {
    selectAreas(next);
    selectTopics(visibleSelection(model, next, selected));
  };
  /** A topic outside the chosen areas brings its area along, or the choice would do nothing. */
  const toggleTopic = (id: number) => {
    if (visible.includes(id)) {
      selectTopics(visible.filter((item) => item !== id));
      return;
    }
    const area = model.areaOf.get(id);
    if (areas.length > 0 && area !== undefined && !areas.includes(area)) {
      selectAreas([...areas, area]);
    }
    selectTopics([...visible, id]);
  };
  return { model, areas, visible, pickAreas, toggleTopic };
}

interface RowProps {
  tag: Tag;
  pressed: boolean;
  end: string | number;
  onToggle: () => void;
  onLeave?: Leave;
}

function TagRow({ tag, pressed, end, onToggle, onLeave }: RowProps) {
  return (
    <div class="fs-row fs-tag">
      <button type="button" class="fs-tag-toggle" aria-pressed={pressed} onClick={onToggle}>
        <Glyph tag={tag} />
        <span class="fs-text fs-tag-name">{tag.name}</span>
        <span class="fs-summary">{end}</span>
        <Tick on={pressed} />
      </button>
      {onLeave && (
        <button
          type="button"
          class="fs-more"
          aria-label={`Edit ${tag.name}`}
          aria-haspopup="menu"
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            onLeave();
            openTagMenu({ tagId: tag.id, x: box.left, y: box.bottom + 4 });
          }}
        >
          <Icon name="ellipsis" size={20} />
        </button>
      )}
    </div>
  );
}

function NewButton({
  kind,
  parent,
  onLeave,
}: {
  kind: TagKind;
  parent: number | null;
  onLeave: Leave;
}) {
  return (
    <button
      type="button"
      class="fs-round fs-end"
      aria-label={`New ${kind}`}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        onLeave();
        openTagEditor({ kind, parent, x: box.left, y: box.bottom + 4 });
      }}
    >
      <Icon name="plus" size={20} />
    </button>
  );
}

function Actions({
  label,
  onAll,
  onNone,
}: {
  label: string;
  onAll: () => void;
  onNone: () => void;
}) {
  return (
    <div class="fs-actions" role="group" aria-label={label}>
      <button type="button" class="fs-action" onClick={onAll}>
        Select all
      </button>
      <button type="button" class="fs-action" onClick={onNone}>
        Clear all
      </button>
    </div>
  );
}

interface PageProps {
  onBack: () => void;
  onLeave: Leave;
}

export function AreasHead({ onBack, onLeave }: PageProps) {
  return (
    <PageHead
      title="Areas"
      onBack={onBack}
      end={<NewButton kind="area" parent={null} onLeave={onLeave} />}
    />
  );
}

export function AreasBody({ onLeave }: { onLeave: Leave }) {
  const { model, areas, pickAreas } = useChoice();
  const counts = useCounts();
  return (
    <>
      <Actions
        label="Areas"
        onAll={() => pickAreas(model.areas.map((tag) => tag.id))}
        onNone={() => pickAreas([])}
      />
      <Group>
        {model.areas.map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            pressed={areas.includes(tag.id)}
            end={counts.get(tag.id) ?? 0}
            onToggle={() => pickAreas(toggleId(areas, tag.id))}
            onLeave={onLeave}
          />
        ))}
      </Group>
    </>
  );
}

/** The topics on screen, grouped by area when more than one area shows. */
function topicGroups(model: TagModel, areas: readonly number[]) {
  return effectiveAreas(model, areas)
    .map((area) => ({ area, topics: topicsIn(model, [area.id]) }))
    .filter((group) => group.topics.length > 0);
}

export function TopicsHead({ onBack, onLeave }: PageProps) {
  const { model, areas } = useChoice();
  const shown = effectiveAreas(model, areas);
  const parent = shown.length === 1 ? shown[0]!.id : null;
  return (
    <PageHead
      title="Topics"
      onBack={onBack}
      end={<NewButton kind="topic" parent={parent} onLeave={onLeave} />}
    />
  );
}

export function TopicsBody({ onLeave }: { onLeave: Leave }) {
  const { model, areas, visible } = useChoice();
  const counts = useCounts();
  const groups = topicGroups(model, areas);
  const all = groups.flatMap((group) => group.topics.map((topic) => topic.id));
  return (
    <>
      <Actions label="Topics" onAll={() => selectTopics(all)} onNone={() => selectTopics([])} />
      {groups.map(({ area, topics }) => (
        <div key={area.id} class="fs-section">
          {groups.length > 1 && <Label>{area.name}</Label>}
          <Group>
            {topics.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                pressed={visible.includes(tag.id)}
                end={counts.get(tag.id) ?? 0}
                onToggle={() => selectTopics(toggleId(visible, tag.id))}
                onLeave={onLeave}
              />
            ))}
          </Group>
        </div>
      ))}
    </>
  );
}

/** Areas and topics whose name holds the query, as rows that toggle at once. */
export function TagResults({ query }: { query: string }) {
  const { model, areas, visible, pickAreas, toggleTopic } = useChoice();
  const counts = useCounts();
  const areaHits = searchNames(model.areas, query);
  const topicHits = searchNames(model.topics, query);
  const areaName = (id: number) => model.byId.get(model.areaOf.get(id) ?? -1)?.name ?? '';
  return (
    <>
      {areaHits.length > 0 && (
        <div class="fs-section">
          <Label>Areas</Label>
          <Group>
            {areaHits.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                pressed={areas.includes(tag.id)}
                end={counts.get(tag.id) ?? 0}
                onToggle={() => pickAreas(toggleId(areas, tag.id))}
              />
            ))}
          </Group>
        </div>
      )}
      {topicHits.length > 0 && (
        <div class="fs-section">
          <Label>Topics</Label>
          <Group>
            {topicHits.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                pressed={visible.includes(tag.id)}
                end={areaName(tag.id)}
                onToggle={() => toggleTopic(tag.id)}
              />
            ))}
          </Group>
        </div>
      )}
    </>
  );
}

export const hasTagHits = (model: TagModel, query: string): boolean =>
  searchNames([...model.areas, ...model.topics], query).length > 0;
