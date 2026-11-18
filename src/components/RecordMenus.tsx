import { useRef, useState } from 'preact/hooks';
import { useChanged, useMountAnimation } from '../motion/change';
import { DURATION, EASE_OUT } from '../motion/tokens';
import { SuccessorPicker } from './SuccessorPicker';
import type { Doc, Tag } from '../api/types';
import { areasOf, statusTag, type TagModel } from '../domain/tags';
import { topicsIn } from '../domain/taxonomy';
import { setStatus, toggleArea, toggleTopic, useApp } from '../state/app';
import { openTagEditor, type TagKind } from '../state/tag-editor';
import { Glyph } from './Glyph';
import { Icon } from '../icons/Icon';
import { Dot, StatusPill } from './Pill';
import { Menu } from './Menu';
import { useHeldHeight } from './useHeld';
import { useWriteDisabled } from '../pwa/connectivity';
import { copyLink } from '../shell/copy-link';
import { VersionItems } from './VersionsMenu';

interface ItemsProps {
  doc: Doc;
  model: TagModel;
  close: () => void;
  /** Open the successor picker in the owner's menu. Without it the items open their own. */
  pick?: (statusId: number) => void;
}

function CheckSlot({ on }: { on: boolean }) {
  return <span class="menu-check">{on && <Icon name="check" size={14} />}</span>;
}

export function StatusItems({ doc, model, close, pick }: ItemsProps) {
  const current = statusTag(doc, model)?.id ?? null;
  const hasSuccessorField = useApp((s) => s.successorField !== null);
  const writeDisabled = useWriteDisabled();
  const [own, setOwn] = useState<number | null>(null);
  const height = useHeldHeight();
  if (own !== null) {
    return (
      <div style={height.style}>
        <SuccessorPicker doc={doc} statusId={own} close={close} />
      </div>
    );
  }
  const setPicker =
    pick ??
    ((statusId: number) => {
      height.hold();
      setOwn(statusId);
    });
  return (
    <div ref={height.ref}>
      {model.statuses.map((tag: Tag) => (
        <button
          key={tag.id}
          type="button"
          role="menuitemradio"
          aria-checked={tag.id === current}
          disabled={writeDisabled}
          class="menu-item"
          onClick={() => {
            if (tag.id === current) {
              close();
              return;
            }
            if (hasSuccessorField && model.statusKey.get(tag.id) === 'superseded') {
              setPicker(tag.id);
              return;
            }
            close();
            void setStatus(doc, tag.id);
          }}
        >
          <CheckSlot on={tag.id === current} />
          <Dot color={tag.color} />
          {tag.name}
        </button>
      ))}
    </div>
  );
}

interface TagItemsProps {
  doc: Doc;
  tags: Tag[];
  toggle: (doc: Doc, id: number) => Promise<void>;
  /** The last area of a record cannot be unticked: every record has at least one. */
  keep?: number | null;
}

function TagItems({ doc, tags, toggle, keep }: TagItemsProps) {
  const writeDisabled = useWriteDisabled();
  return (
    <>
      {tags.map((tag) => {
        const on = doc.tags.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            role="menuitemcheckbox"
            aria-checked={on}
            disabled={writeDisabled || keep === tag.id}
            class="menu-item"
            onClick={() => void toggle(doc, tag.id)}
          >
            <CheckSlot on={on} />
            <Glyph tag={tag} />
            {tag.name}
          </button>
        );
      })}
    </>
  );
}

function NewTag({
  doc,
  kind,
  parent,
  close,
}: {
  doc: Doc;
  kind: TagKind;
  parent: number | null;
  close: () => void;
}) {
  const writeDisabled = useWriteDisabled();
  return (
    <button
      type="button"
      role="menuitem"
      class="menu-item"
      disabled={writeDisabled}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        close();
        openTagEditor({ kind, parent, recordId: doc.id, x: box.left, y: box.top });
      }}
    >
      <span class="menu-check">
        <Icon name="plus" size={14} />
      </span>
      {kind === 'area' ? 'New area…' : 'New topic…'}
    </button>
  );
}

/** A new status settles in: the pill grows from its left edge and fades up, once. */
const PILL_IN: Keyframe[] = [
  { opacity: 0.35, transform: 'scale(0.9)' },
  { opacity: 1, transform: 'none' },
];

export function StatusMenu({ doc, model }: { doc: Doc; model: TagModel }) {
  const tag = statusTag(doc, model);
  const writeDisabled = useWriteDisabled();
  const pill = useRef<HTMLSpanElement>(null);
  const changed = useChanged(doc.id, tag?.id ?? 0);
  useMountAnimation(pill, changed, PILL_IN, { duration: DURATION.menu, easing: EASE_OUT });
  return (
    <Menu
      label="Status"
      disabled={writeDisabled}
      triggerClass="pill-button"
      trigger={
        <>
          <span ref={pill} class="pill-morph">
            {tag ? <StatusPill tag={tag} /> : 'Status'}
          </span>
          <Icon name="chevron_down" size={14} />
        </>
      }
    >
      {(close) => <StatusItems doc={doc} model={model} close={close} />}
    </Menu>
  );
}

interface MoreProps {
  doc: Doc;
  model: TagModel;
  up?: boolean;
  onDelete: () => void;
  /** What the toolbar gives up on a narrow pane. Shown here only while it is not in the toolbar. */
  collapsed?: { path: string; version: number | null };
}

/** Copy link and Versions, for when the toolbar has no room for their buttons. */
function Collapsed({
  doc,
  path,
  version,
  close,
}: MoreProps['collapsed'] & { doc: Doc; close: () => void }) {
  return (
    <>
      <button
        type="button"
        role="menuitem"
        class="menu-item menu-collapsed menu-collapsed--copy"
        onClick={() => {
          close();
          void copyLink(path);
        }}
      >
        <span class="menu-check">
          <Icon name="link" size={14} />
        </span>
        Copy link
      </button>
      {doc.versions.length > 1 && (
        <div class="menu-collapsed menu-collapsed--versions">
          <div class="menu-label">Versions</div>
          <VersionItems doc={doc} version={version} close={close} />
        </div>
      )}
      <div class="menu-sep menu-collapsed menu-collapsed--copy" />
    </>
  );
}

function MoreBody({ doc, model, close, onDelete, collapsed }: MoreProps & { close: () => void }) {
  const [picker, setPicker] = useState<number | null>(null);
  const height = useHeldHeight();
  const areas = areasOf(doc, model);
  const areaIds = areas.map((tag) => tag.id);
  const topics = topicsIn(model, areaIds);
  const writeDisabled = useWriteDisabled();
  // The successor picker replaces the whole menu, so nothing below it is pushed around.
  if (picker !== null) {
    return (
      <div style={height.style}>
        <SuccessorPicker doc={doc} statusId={picker} close={close} />
      </div>
    );
  }
  return (
    <div ref={height.ref}>
      {collapsed && <Collapsed doc={doc} close={close} {...collapsed} />}
      <div class="menu-label">Status</div>
      <StatusItems
        doc={doc}
        model={model}
        close={close}
        pick={(statusId) => {
          height.hold();
          setPicker(statusId);
        }}
      />
      <div class="menu-sep" />
      <div class="menu-label">Areas</div>
      <TagItems
        doc={doc}
        tags={model.areas}
        toggle={toggleArea}
        keep={areaIds.length === 1 ? areaIds[0] : null}
      />
      <NewTag doc={doc} kind="area" parent={null} close={close} />
      <div class="menu-label">Topics</div>
      <TagItems doc={doc} tags={topics} toggle={toggleTopic} />
      <NewTag doc={doc} kind="topic" parent={areaIds[0] ?? null} close={close} />
      <div class="menu-sep" />
      <button
        type="button"
        role="menuitem"
        class="menu-item menu-item--danger"
        disabled={writeDisabled}
        onClick={() => {
          close();
          onDelete();
        }}
      >
        <span class="menu-check" />
        <Icon name="trash" size={14} />
        Delete
      </button>
    </div>
  );
}

export function MoreMenu({ doc, model, up, onDelete, collapsed }: MoreProps) {
  return (
    <Menu label="More" up={up} trigger={<Icon name="ellipsis" />}>
      {(close) => (
        <MoreBody
          doc={doc}
          model={model}
          close={close}
          up={up}
          onDelete={onDelete}
          collapsed={collapsed}
        />
      )}
    </Menu>
  );
}
