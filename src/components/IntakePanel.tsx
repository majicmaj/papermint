import { useWriteDisabled } from '../pwa/connectivity';
import { useMemo, useState } from 'preact/hooks';
import type { Doc } from '../api/types';
import { Icon } from '../icons/Icon';
import { matchTitle } from '../palette';
import { MultiSelect } from './MultiSelect';
import { topicsIn } from '../domain/taxonomy';
import { useApp } from '../state/app';
import { confirmUpload, dismissUpload, updateUpload, type UploadItem } from '../state/uploads';

const PICKER_LIMIT = 5;

function useMatches(docs: Doc[], query: string, exclude: number | null): Doc[] {
  return useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return docs
      .filter((d) => d.id !== exclude)
      .flatMap((d) => {
        const hit = matchTitle(d.title, q);
        return hit ? [{ d, score: hit.score }] : [];
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, PICKER_LIMIT)
      .map((m) => m.d);
  }, [docs, query, exclude]);
}

/** Pick the record this file becomes the newest version of. Searches the cached index. */
function VersionPicker({ item }: { item: UploadItem }) {
  const docs = useApp((s) => s.docs);
  const [query, setQuery] = useState('');
  const matches = useMatches(docs, query, item.docId);
  const target = item.targetId === null ? null : (docs.find((d) => d.id === item.targetId) ?? null);
  if (target) {
    return (
      <div class="field field--chosen">
        <Icon name="layers" size={14} />
        <span class="field-text">{target.title}</span>
        <button
          type="button"
          class="field-clear"
          aria-label="Clear"
          onClick={() => updateUpload(item.key, { targetId: null })}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
    );
  }
  return (
    <div class="picker">
      <input
        class="field"
        value={query}
        placeholder="Add as version of…"
        spellcheck={false}
        autocomplete="off"
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />
      {matches.length > 0 && (
        <div class="picker-list" role="listbox">
          {matches.map((doc) => (
            <button
              key={doc.id}
              type="button"
              role="option"
              aria-selected="false"
              class="picker-item"
              onClick={() => {
                updateUpload(item.key, { targetId: doc.id });
                setQuery('');
              }}
            >
              {doc.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Selects({ item }: { item: UploadItem }) {
  const model = useApp((s) => s.model);
  const locked = item.targetId !== null;
  const set = (patch: Partial<UploadItem>) => updateUpload(item.key, patch);
  const topics = topicsIn(model, item.areaIds);
  const pickAreas = (areaIds: number[]) =>
    set({
      areaIds,
      topicIds: item.topicIds.filter((id) => topicsIn(model, areaIds).some((t) => t.id === id)),
    });
  return (
    <>
      <div class="intake-pair">
        <select
          class="field"
          aria-label="Status"
          disabled={locked}
          value={item.statusId ?? ''}
          onChange={(e) => set({ statusId: Number((e.target as HTMLSelectElement).value) || null })}
        >
          <option value="">No status</option>
          {model.statuses.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <MultiSelect
          label="Area"
          options={model.areas}
          value={item.areaIds}
          disabled={locked}
          onChange={pickAreas}
        />
      </div>
      <MultiSelect
        label="Topics"
        options={topics}
        value={item.topicIds}
        disabled={locked || topics.length === 0}
        onChange={(topicIds) => set({ topicIds })}
      />
    </>
  );
}

function Head({ item, position }: { item: UploadItem; position: string }) {
  const busy = item.phase === 'sending' || item.phase === 'filing' || item.phase === 'saving';
  const width = item.phase === 'sending' ? item.progress * 100 : 100;
  return (
    <div class="intake-head">
      <span class="intake-name">{item.name}</span>
      <span class="intake-count">{position}</span>
      <span class="progress" role="progressbar" aria-valuenow={Math.round(width)} hidden={!busy}>
        <span
          class="progress-fill"
          style={{ width: `${width}%` }}
          data-filing={item.phase !== 'sending'}
        />
      </span>
      <button
        type="button"
        class="btn btn--icon btn--ghost"
        aria-label="Dismiss"
        style={{ visibility: busy ? 'hidden' : 'visible' }}
        onClick={() => dismissUpload(item.key)}
      >
        <Icon name="x" />
      </button>
    </div>
  );
}

/**
 * Filing form for the oldest unconfirmed upload. It is a fixed-size layer above the
 * list, so it never moves anything. Fields work while the file is still being sent.
 */
export function IntakePanel() {
  const hasAreas = useApp((s) => s.model.areas.length > 0);
  const uploads = useApp((s) => s.uploads);
  const writeDisabled = useWriteDisabled();
  const item = uploads[0];
  if (!item) return null;
  const filed = !hasAreas || item.areaIds.length > 0 || item.targetId !== null;
  // Offline, Confirm stays off. A file that was dropped offline waits here; when the network is
  // back Confirm turns on, and only Confirm sends it.
  const confirmable = item.phase === 'ready' || item.phase === 'waiting';
  const ready = confirmable && item.title.trim().length > 0 && filed && !writeDisabled;
  const position = uploads.length > 1 ? `1/${uploads.length}` : '';
  return (
    <aside class="intake" aria-label="Upload" key={item.key}>
      <Head item={item} position={position} />
      <input
        class="field"
        value={item.title}
        placeholder="Title"
        spellcheck={false}
        onInput={(e) => updateUpload(item.key, { title: (e.target as HTMLInputElement).value })}
        onKeyDown={(e) => e.key === 'Enter' && ready && void confirmUpload(item.key)}
      />
      <Selects item={item} />
      <VersionPicker item={item} />
      <div class="intake-foot">
        <span class="intake-state">{item.phase === 'failed' ? 'Failed' : ''}</span>
        <button
          type="button"
          class="btn btn--primary"
          disabled={!ready}
          onClick={() => void confirmUpload(item.key)}
        >
          Confirm
        </button>
      </div>
    </aside>
  );
}
