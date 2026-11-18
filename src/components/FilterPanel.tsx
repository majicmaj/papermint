import type { Filters } from '../domain/filters';
import { loadSizes } from '../state/sizes';

type Update = (patch: Partial<Filters>) => void;
type DateKey = 'created' | 'added' | 'modified';

const DATES: [DateKey, string][] = [
  ['created', 'Created'],
  ['added', 'Added'],
  ['modified', 'Modified'],
];

function DateRow({ name, field, filters, update }: RowProps<DateKey>) {
  const from = filters[`${field}From`];
  const to = filters[`${field}To`];
  // Both inputs are always there, so choosing a date moves nothing in the panel.
  return (
    <div class="fp-row fp-dates">
      <span>{name}</span>
      <input
        class="field"
        type="date"
        aria-label={`${name} from`}
        value={from}
        onInput={(event) => update({ [`${field}From`]: event.currentTarget.value })}
      />
      <input
        class="field"
        type="date"
        aria-label={`${name} to`}
        value={to}
        onInput={(event) => update({ [`${field}To`]: event.currentTarget.value })}
      />
    </div>
  );
}

interface RowProps<K extends string> {
  name: string;
  field: K;
  filters: Filters;
  update: Update;
}

type Pair = 'Size' | 'Pages';

const kb = (bytes: string) => (bytes ? String(Number(bytes) / 1000) : '');
const toBytes = (value: string) => (value ? String(Math.round(Number(value) * 1000)) : '');

function RangeRow({ name, filters, update }: { name: Pair; filters: Filters; update: Update }) {
  const size = name === 'Size';
  const min = size ? 'minSize' : 'minPages';
  const max = size ? 'maxSize' : 'maxPages';
  const read = (key: 'minSize' | 'maxSize' | 'minPages' | 'maxPages') =>
    size ? kb(filters[key]) : filters[key];
  const write = (key: string, value: string) => update({ [key]: size ? toBytes(value) : value });
  return (
    <div class="fp-row">
      <span>{size ? 'Size KB' : 'Pages'}</span>
      <span class="fp-pair">
        {[min, max].map((key, index) => (
          <input
            key={key}
            class="field"
            type="number"
            min="0"
            aria-label={`${index === 0 ? 'Minimum' : 'Maximum'} ${name.toLowerCase()}`}
            placeholder={index === 0 ? 'Min' : 'Max'}
            value={read(key as 'minSize')}
            onFocus={size ? () => void loadSizes() : undefined}
            onInput={(event) => write(key, event.currentTarget.value)}
          />
        ))}
      </span>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label class="fp-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      {label}
    </label>
  );
}

export function FilterPanel({
  filters,
  update,
  mimes,
}: {
  filters: Filters;
  update: Update;
  mimes: string[];
}) {
  return (
    <div class="filter-panel">
      {DATES.map(([field, name]) => (
        <DateRow key={field} name={name} field={field} filters={filters} update={update} />
      ))}
      <RangeRow name="Size" filters={filters} update={update} />
      <RangeRow name="Pages" filters={filters} update={update} />
      <label class="fp-row">
        <span>Type</span>
        <select
          class="field"
          aria-label="Type"
          value={filters.mime}
          onChange={(event) => update({ mime: event.currentTarget.value })}
        >
          <option value="">Any</option>
          {mimes.map((mime) => (
            <option key={mime} value={mime}>
              {mime}
            </option>
          ))}
        </select>
      </label>
      <div class="fp-checks">
        <Check
          label="Versions"
          checked={filters.versions}
          onChange={(versions) => update({ versions })}
        />
        <Check label="Signed" checked={filters.signed} onChange={(signed) => update({ signed })} />
        <Check
          label="Superseded"
          checked={filters.superseded}
          onChange={(superseded) => update({ superseded })}
        />
      </div>
    </div>
  );
}
