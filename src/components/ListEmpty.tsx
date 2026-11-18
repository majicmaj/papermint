import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/paths';
import { runtimeConfig } from '../config/runtime';
import { pickFiles } from '../state/actions';
import { clearFilters } from '../state/filters';

interface Props {
  filtered: boolean;
}

/** An empty list: one mark, one line, and the one action that changes it. */
export function ListEmpty({ filtered }: Props) {
  const icon: IconName = filtered ? 'search' : 'files';
  const title = filtered ? 'No records match' : 'No records';
  const upload = !filtered && !runtimeConfig().readOnly;
  return (
    <div class="list-empty-state">
      <span class="list-empty-mark">
        <Icon name={icon} size={20} />
      </span>
      <p class="list-empty-title">{title}</p>
      {filtered && (
        <button type="button" class="btn btn--ghost" onClick={clearFilters}>
          Clear filters
        </button>
      )}
      {upload && (
        <button type="button" class="btn btn--ghost" onClick={pickFiles}>
          <Icon name="upload" size={14} />
          Upload
        </button>
      )}
    </div>
  );
}
