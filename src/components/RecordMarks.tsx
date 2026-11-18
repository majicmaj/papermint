import './marks.css';
import type { Doc } from '../api/types';
import { sensitive, signed } from '../domain/record-details';
import { Icon } from '../icons/Icon';
import { useApp } from '../state/app';
import { Menu } from './Menu';
import { RecordLink, SupersededBy, useLinks } from './SupersededBy';

function Replaces({ doc }: { doc: Doc }) {
  const { replaced } = useLinks(doc);
  if (replaced.length === 0) return null;
  return (
    <Menu label="Replaces" triggerClass="marks-replaces" trigger={`Replaces ${replaced.length}`}>
      {(close) =>
        replaced.map((item) => <RecordLink key={item.id} doc={item} item onOpen={close} />)
      }
    </Menu>
  );
}

/** The Signed and Sensitive markers: small icons, no words. */
export function Badges({ doc }: { doc: Doc }) {
  const tags = useApp((state) => state.tags);
  return (
    <>
      {sensitive(doc, tags) && (
        <span class="marks-signed" role="img" aria-label="Sensitive" title="Sensitive">
          <Icon name="lock" size={16} />
        </span>
      )}
      {signed(doc, tags) && (
        <span class="marks-signed" role="img" aria-label="Signed" title="Signed">
          <Icon name="badge_check" size={16} />
        </span>
      )}
    </>
  );
}

/** The successor of a Superseded record, and what a Current record replaced. */
export function Context({ doc }: { doc: Doc }) {
  return (
    <>
      <SupersededBy doc={doc} />
      <Replaces doc={doc} />
    </>
  );
}

/**
 * What the record header shows about status beyond the pill: the Signed marker, the
 * successor of a Superseded record, and what a Current record replaced.
 */
export function RecordMarks({ doc }: { doc: Doc }) {
  return (
    <span class="marks">
      <Badges doc={doc} />
      <Context doc={doc} />
    </span>
  );
}
