import type { Doc } from '../api/types';
import { downloadUrl } from '../api/documents';
import { selectedVersionId, versionName } from '../domain/versions';
import { Icon } from '../icons/Icon';
import { navigate, recordPath } from '../state/router';
import { Menu } from './Menu';

interface Props {
  doc: Doc;
  /** The version in the URL, or null for the current one. */
  version: number | null;
  up?: boolean;
}

/** One entry per version, each addressing its exact version id. Shared by the button and the ⋯ menu. */
export function VersionItems({
  doc,
  version,
  close,
}: {
  doc: Doc;
  version: number | null;
  close: () => void;
}) {
  const selected = selectedVersionId(doc, version);
  return (
    <>
      {doc.versions.map((v) => (
        <div key={v.id} class="menu-row">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={v.id === selected}
            class="menu-item"
            data-version={v.id}
            onClick={() => {
              close();
              navigate(recordPath(doc.id, v.id));
            }}
          >
            <span class="menu-check">{v.id === selected && <Icon name="check" size={14} />}</span>
            {versionName(v)}
          </button>
          <a
            class="btn btn--icon btn--ghost menu-download"
            href={downloadUrl(doc.id, v.id)}
            download
            aria-label={`Download ${versionName(v)}`}
          >
            <Icon name="download" size={14} />
          </a>
        </div>
      ))}
    </>
  );
}

export function VersionsMenu({ doc, version, up }: Props) {
  return (
    <Menu
      label="Versions"
      up={up}
      hostClass="menu-host--versions"
      disabled={doc.versions.length < 2}
      trigger={<Icon name="layers" />}
      triggerClass="btn btn--icon btn--ghost"
    >
      {(close) => <VersionItems doc={doc} version={version} close={close} />}
    </Menu>
  );
}
