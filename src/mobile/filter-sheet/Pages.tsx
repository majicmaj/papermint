import { typeName, type Filters } from '../../domain/filters';
import { SORTS, type SortProps } from '../../components/SortRows';
import { loadSizes } from '../../state/sizes';
import { bytesToKb, datePresets, kbToBytes, labelOf, presetOf, type DateField } from '../rows';
import { ChoiceRow, FieldRow, Group, Label } from './parts';

type Update = (patch: Partial<Filters>) => void;

interface FilterProps {
  filters: Filters;
  update: Update;
}

/** Presets first, then the two dates. Both inputs are always there, so a choice moves nothing. */
export function DateBody({
  field,
  filters,
  update,
  today,
}: FilterProps & { field: DateField; today: Date }) {
  const name = labelOf(field);
  const from = filters[`${field}From`];
  const to = filters[`${field}To`];
  const active = presetOf(from, to, today);
  return (
    <>
      <Group role="radiogroup" label={name}>
        {datePresets(today).map((preset) => (
          <ChoiceRow
            key={preset.id}
            label={preset.label}
            checked={active?.id === preset.id}
            onChoose={() => update({ [`${field}From`]: preset.from, [`${field}To`]: preset.to })}
          />
        ))}
      </Group>
      <Label>Range</Label>
      <Group>
        {(['From', 'To'] as const).map((end) => (
          <FieldRow key={end} label={end}>
            <input
              class="fs-input"
              type="date"
              aria-label={`${name} ${end.toLowerCase()}`}
              value={end === 'From' ? from : to}
              data-empty={(end === 'From' ? from : to) ? undefined : 'true'}
              onInput={(event) => update({ [`${field}${end}`]: event.currentTarget.value })}
            />
          </FieldRow>
        ))}
      </Group>
    </>
  );
}

/** Minimum and maximum. Sizes are typed in KB and kept in bytes, like the desktop panel. */
export function RangeBody({ kind, filters, update }: FilterProps & { kind: 'size' | 'pages' }) {
  const size = kind === 'size';
  const keys = size ? (['minSize', 'maxSize'] as const) : (['minPages', 'maxPages'] as const);
  return (
    <Group>
      {keys.map((key, index) => {
        const label = index === 0 ? 'Minimum' : 'Maximum';
        return (
          <FieldRow key={key} label={label}>
            <input
              class="fs-input"
              type="number"
              min="0"
              inputMode={size ? 'decimal' : 'numeric'}
              enterKeyHint="done"
              aria-label={`${label} ${kind}`}
              placeholder="Any"
              value={size ? bytesToKb(filters[key]) : filters[key]}
              onFocus={size ? () => void loadSizes() : undefined}
              onInput={(event) => {
                const value = event.currentTarget.value;
                update({ [key]: size ? kbToBytes(value) : value });
              }}
            />
            {size && <span class="fs-unit">KB</span>}
          </FieldRow>
        );
      })}
    </Group>
  );
}

export function TypeBody({ filters, update, mimes }: FilterProps & { mimes: string[] }) {
  return (
    <Group role="radiogroup" label="Type">
      <ChoiceRow label="Any" checked={!filters.mime} onChoose={() => update({ mime: '' })} />
      {mimes.map((mime) => (
        <ChoiceRow
          key={mime}
          label={typeName(mime)}
          checked={filters.mime === mime}
          onChoose={() => update({ mime })}
        />
      ))}
    </Group>
  );
}

/** The sort keys, then the direction. The same state as the desktop Sort menu. */
export function SortBody({ sort, setSort, ascending, setAscending }: SortProps) {
  return (
    <>
      <Group role="radiogroup" label="Sort">
        {SORTS.map(([key, name]) => (
          <ChoiceRow
            key={key}
            label={name}
            checked={sort === key}
            onChoose={() => {
              setSort(key);
              if (key === 'size') void loadSizes();
            }}
          />
        ))}
      </Group>
      <Label>Order</Label>
      <Group role="radiogroup" label="Order">
        <ChoiceRow label="Descending" checked={!ascending} onChoose={() => setAscending(false)} />
        <ChoiceRow label="Ascending" checked={ascending} onChoose={() => setAscending(true)} />
      </Group>
    </>
  );
}
