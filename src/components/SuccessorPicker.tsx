import { useEffect, useRef, useState } from 'preact/hooks';
import type { Doc } from '../api/types';
import { statusOf } from '../domain/tags';
import { setStatus, useApp } from '../state/app';

export function SuccessorPicker({
  doc,
  statusId,
  close,
}: {
  doc: Doc;
  statusId: number;
  close: () => void;
}) {
  const docs = useApp((state) => state.docs);
  const model = useApp((state) => state.model);
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const matches = docs.filter(
    (item) =>
      item.id !== doc.id &&
      statusOf(item, model) !== 'superseded' &&
      item.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div class="successor-picker">
      <input
        ref={input}
        class="field"
        placeholder="Search"
        autocomplete="off"
        spellcheck={false}
        aria-label="Search records"
        value={query}
        onInput={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && matches[0]) {
            event.preventDefault();
            void setStatus(doc, statusId, matches[0].id);
            close();
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('button')?.focus();
          }
        }}
      />
      {matches.map((item) => (
        <button
          type="button"
          role="menuitem"
          class="menu-item"
          key={item.id}
          onClick={() => {
            void setStatus(doc, statusId, item.id);
            close();
          }}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}
