import { useEffect, useMemo, useState } from 'preact/hooks';
import { downloadUrl, fetchDoc } from '../api/documents';
import { ApiError } from '../api/http';
import type { Doc } from '../api/types';
import { formatDate } from '../domain/format';
import { statusTag, topicsOf, type TagModel } from '../domain/tags';
import { VIEW_PATH } from '../domain/views';
import { findVersion, isCurrent, resolveVersion, selectedVersionId } from '../domain/versions';
import { Icon } from '../icons/Icon';
import { registerPaletteRecord } from '../state/actions';
import { useApp } from '../state/app';
import { copyLink } from '../shell/copy-link';
import { openDeleteDialog } from '../state/dialog';
import { navigate, recordPath, type Route } from '../state/router';
import { Frame } from '../shell/Frame';
import { useMetaFit } from '../shell/meta-fit';
import { FilePane } from '../shell/FilePane';
import { sensitive as sensitiveRecord } from '../domain/record-details';
import { Dot } from './Pill';
import { Badges, Context } from './RecordMarks';
import { Preview, PreviewFailed } from './Preview';
import { MoreMenu, StatusMenu } from './RecordMenus';
import { VersionsMenu } from './VersionsMenu';

type RecordRoute = Extract<Route, { name: 'record' }>;
type Lookup = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; doc: Doc };

/** Find the record in the cached index; fall back to one request for unknown ids. */
function useRecord(id: number): Lookup {
  const docs = useApp((s) => s.docs);
  const phase = useApp((s) => s.phase);
  const [fetched, setFetched] = useState<Doc | null>(null);
  const [failed, setFailed] = useState(false);
  const known = docs.find((d) => d.id === id) ?? null;
  useEffect(() => {
    setFetched(null);
    setFailed(false);
    if (id === 0 || known || phase === 'loading') return;
    const abort = new AbortController();
    fetchDoc(id, abort.signal)
      .then(setFetched)
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        setFailed(error instanceof ApiError || error instanceof TypeError);
      });
    return () => abort.abort();
  }, [id, phase, known === null]);
  useEffect(() => (fetched ? registerPaletteRecord(fetched) : undefined), [fetched]);
  const doc = known ?? (fetched?.id === id ? fetched : null);
  if (doc) return { state: 'ready', doc };
  return failed ? { state: 'missing' } : { state: 'loading' };
}

function CopyButton({ path }: { path: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), 1400);
    return () => clearTimeout(timer);
  }, [done]);
  return (
    <button
      type="button"
      class="btn btn--ghost btn--grow btn-copy"
      onClick={() => void copyLink(path).then((ok) => ok && setDone(true))}
    >
      <Icon name={done ? 'check' : 'link'} />
      Copy link
    </button>
  );
}

interface PaneProps {
  doc: Doc;
  route: RecordRoute;
  model: TagModel;
}

/** One line across the pane: the first items matter most, the last ones leave first. */
function Meta({ doc, route, model }: PaneProps) {
  const line = useMetaFit();
  const topics = topicsOf(doc, model).slice(0, 2);
  const current = isCurrent(doc, route.version);
  const version = findVersion(doc, selectedVersionId(doc, route.version));
  const versioned = version && (doc.versions.length > 1 || version.label?.trim());
  const label =
    version?.label?.trim() ||
    (current ? 'Current version' : version?.isRoot ? 'Original' : 'Version');
  const pages = current && doc.pageCount ? `${doc.pageCount} p` : null;
  return (
    <div class="pane-meta" ref={line}>
      {versioned && (
        <span class="pane-version" data-rank="1" title={label}>
          {label}
        </span>
      )}
      <time class="pane-date" data-rank="2" dateTime={versioned ? version.added : doc.created}>
        {formatDate(versioned ? version.added : doc.created)}
      </time>
      <span class="marks" data-rank="3">
        <Context doc={doc} />
      </span>
      {pages && (
        <span class="pane-pages" data-rank="4">
          {pages}
        </span>
      )}
      {topics.map((t, i) => (
        <span key={t.id} class="pane-topic" data-rank={5 + i}>
          <Dot color={t.color} />
          {t.name}
        </span>
      ))}
    </div>
  );
}

interface ActionsProps extends PaneProps {
  onDelete: () => void;
  up?: boolean;
}

function Actions({ doc, route, model, onDelete, up }: ActionsProps) {
  const version = selectedVersionId(doc, route.version);
  return (
    <>
      <a
        class="btn btn--primary btn--grow"
        href={downloadUrl(doc.id, version)}
        download
        aria-label="Download"
      >
        <Icon name="download" />
        <span class="btn-label">Download</span>
      </a>
      <CopyButton path={recordPath(doc.id, route.version)} />
      <VersionsMenu doc={doc} version={route.version} up={up} />
      <MoreMenu
        doc={doc}
        model={model}
        up={up}
        onDelete={onDelete}
        collapsed={{ path: recordPath(doc.id, route.version), version: route.version }}
      />
    </>
  );
}

/** The same buttons, disabled. Used before the record is known, so nothing moves later. */
function IdleActions() {
  return (
    <>
      <span class="btn btn--primary btn--grow" aria-disabled="true">
        <Icon name="download" />
        <span class="btn-label">Download</span>
      </span>
      <span class="btn btn--ghost btn--grow btn-copy" aria-disabled="true">
        <Icon name="link" />
        Copy link
      </span>
      <span class="btn btn--icon btn--ghost menu-host--versions" aria-disabled="true">
        <Icon name="layers" />
      </span>
      <span class="btn btn--icon btn--ghost" aria-disabled="true">
        <Icon name="ellipsis" />
      </span>
    </>
  );
}

function VersionMissing({ doc, route }: Pick<PaneProps, 'doc' | 'route'>) {
  const home = VIEW_PATH[route.from ?? 'records'];
  return (
    <Frame
      terminal
      title={<h1>Version not found</h1>}
      meta={
        <div class="pane-meta">
          <a
            class="pane-link"
            href={recordPath(doc.id)}
            onClick={(e) => {
              e.preventDefault();
              navigate(recordPath(doc.id), { replace: true });
            }}
          >
            Current version
          </a>
        </div>
      }
      actions={() => <IdleActions />}
      body={<PreviewFailed />}
      onBack={() => navigate(home)}
    />
  );
}

function Loaded({ doc, route, model }: PaneProps) {
  const status = useMemo(() => statusTag(doc, model), [doc, model]);
  const resolved = resolveVersion(doc, route.version);
  if (resolved.state === 'invalid') return <VersionMissing doc={doc} route={route} />;
  const version = resolved.id;
  const home = VIEW_PATH[route.from ?? 'records'];
  return (
    <Frame
      titleKey={`${doc.id}:${version}`}
      title={
        <div class="pane-titleline">
          <h1 title={doc.title}>{doc.title}</h1>
          <span class="marks">
            <Badges doc={doc} />
          </span>
        </div>
      }
      meta={<Meta doc={doc} route={route} model={model} />}
      statusKey={`${doc.id}:${status?.id ?? 0}:${version}`}
      status={
        isCurrent(doc, route.version) ? (
          <StatusMenu doc={doc} model={model} key={status?.id ?? 0} />
        ) : null
      }
      actions={(up) => (
        <Actions
          doc={doc}
          route={route}
          model={model}
          up={up}
          onDelete={() => openDeleteDialog(doc.id, doc.title)}
        />
      )}
      body={<Preview doc={doc} version={version} sensitive={isSensitive(doc, model)} />}
      onBack={() => navigate(home)}
    />
  );
}

const isSensitive = (doc: Doc, model: TagModel) =>
  sensitiveRecord(doc, Array.from(model.byId.values()));

function Idle({ missing }: { missing: boolean }) {
  return (
    <Frame
      terminal={missing}
      title={
        missing ? (
          <h1>Not found</h1>
        ) : (
          <div class="pane-skeleton">
            <div class="skeleton-bar" style={{ width: '46%', height: 14 }} />
          </div>
        )
      }
      meta={
        <div class="pane-meta">
          {!missing && <div class="skeleton-bar" style={{ width: '24%', height: 10 }} />}
        </div>
      }
      status={missing ? null : <div class="skeleton-bar" style={{ width: 72, height: 20 }} />}
      actions={() => <IdleActions />}
      body={missing ? <PreviewFailed /> : null}
      onBack={() => navigate(VIEW_PATH.records)}
    />
  );
}

export function RecordPane({ route }: { route: Route }) {
  const model = useApp((s) => s.model);
  const lookup = useRecord(route.name === 'record' ? route.id : 0);
  if (route.name === 'file') return <FilePane route={route} />;
  // With no record selected the pane is not part of the layout at all.
  if (route.name !== 'record') return null;
  if (lookup.state === 'ready') return <Loaded doc={lookup.doc} route={route} model={model} />;
  // A new key swaps the whole pane when loading ends in 'missing', so nothing moves.
  return <Idle key={lookup.state} missing={lookup.state === 'missing'} />;
}
