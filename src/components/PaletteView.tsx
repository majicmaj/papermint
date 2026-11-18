import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Command, Item, PaletteState, Range } from '../palette';
import { Icon } from '../icons/Icon';
import { palette } from '../state/actions';
import { Dot } from './Pill';
import { useVisualHeight } from '../mobile/viewport';
import { highlightsSupported, useMatchHighlight } from './useMatchHighlight';

const PAINTED = highlightsSupported();

export function usePalette(): PaletteState {
  const [state, setState] = useState(palette.getState());
  useEffect(() => palette.subscribe(setState), []);
  return state;
}

function Highlighted({ text, ranges }: { text: string; ranges: Range[] }) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: ComponentChildren[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(<mark key={start}>{text.slice(start, end)}</mark>);
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

/** One text node when the browser paints matches itself, marked segments otherwise. */
function Snippet({ snippet }: { snippet: NonNullable<Item['snippet']> }) {
  if (PAINTED) return <>{snippet.map((seg) => seg.text).join('')}</>;
  return (
    <>
      {snippet.map((seg, i) =>
        seg.hit ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>,
      )}
    </>
  );
}

interface RowProps {
  item: Item;
  index: number;
  selected: boolean;
}

/** Title and status pill on line one. A full-text snippet or the date on line two. */
function ResultRow({ item, index, selected }: RowProps) {
  return (
    <div
      class="result"
      role="option"
      id={`result-${index}`}
      aria-selected={selected}
      data-id={item.id}
      data-source={item.source}
      onPointerMove={(e) => e.pointerType === 'mouse' && !selected && palette.select(index)}
      onClick={() => palette.activate('open', index)}
    >
      <span class="result-line">
        <span class="result-title">
          {PAINTED ? item.title : <Highlighted text={item.title} ranges={item.ranges} />}
        </span>
        {/* A fixed column: a different status, or none, moves nothing in the row. */}
        <span class="result-badge">
          {item.badge && (
            <span class="pill">
              <Dot color={item.badge.color} />
              {item.badge.label}
            </span>
          )}
        </span>
      </span>
      <span class="result-sub">
        {item.snippet ? <Snippet snippet={item.snippet} /> : item.hint}
      </span>
    </div>
  );
}

function CommandRow({
  command,
  index,
  selected,
}: {
  command: Command;
  index: number;
  selected: boolean;
}) {
  return (
    <div
      class="palette-command"
      role="option"
      id={`result-${index}`}
      aria-selected={selected}
      onMouseDown={(e) => e.preventDefault()}
      onPointerMove={(e) => e.pointerType === 'mouse' && !selected && palette.select(index)}
      onClick={() => palette.activate('open', index)}
    >
      <Icon name={command.icon} />
      <span class="palette-command-label">{command.title}</span>
      {command.detail && <span class="palette-command-detail">{command.detail}</span>}
    </div>
  );
}

function PaletteResults({ state }: { state: PaletteState }) {
  const list = useRef<HTMLDivElement>(null);
  useMatchHighlight(list, state.items);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [state.selected, state.items, state.commands]);
  return (
    <div class="palette-list" role="listbox" id="palette-results" ref={list}>
      {state.title && (
        <div class="palette-context" role="presentation" title={state.title}>
          {state.title}
        </div>
      )}
      {state.items.map((item, index) => (
        // Keep result slots in place when typing changes which record occupies one.
        <ResultRow key={index} item={item} index={index} selected={index === state.selected} />
      ))}
      {state.commands.map((command, index) => {
        const slot = index + state.items.length;
        return (
          <CommandRow
            key={index}
            command={command}
            index={slot}
            selected={slot === state.selected}
          />
        );
      })}
      {state.failed && (
        <div class="result-status">
          <span>Search failed</span>
          <button type="button" class="btn btn--ghost" onClick={() => palette.retry()}>
            Retry
          </button>
        </div>
      )}
      {state.items.length === 0 && !state.failed && !state.searching && state.query.trim() && (
        <div class="result-status">
          <span>No results</span>
        </div>
      )}
    </div>
  );
}

/** Tab cycles between the search field and the Retry button. Focus never leaves the palette. */
function cycleFocus(event: KeyboardEvent): void {
  const root = event.currentTarget as HTMLElement;
  // A control that is not drawn (the phone's Close on a desktop) takes no focus.
  const stops = Array.from(root.querySelectorAll<HTMLElement>('input, button')).filter(
    (el) => el.getClientRects().length > 0,
  );
  const at = stops.indexOf(document.activeElement as HTMLElement);
  const next = (at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
  stops[next]?.focus();
}

/** Keys the palette handles. It stops them here so nothing behind it reacts. */
function handleKey(event: KeyboardEvent): void {
  const onButton = (event.target as HTMLElement).tagName === 'BUTTON';
  if (onButton && (event.key === 'Enter' || event.key === ' ')) {
    event.stopPropagation();
    return;
  }
  const actions: Record<string, () => void> = {
    Escape: () => {
      const { nested } = palette.getState();
      palette.back();
      if (nested) (event.currentTarget as HTMLElement).querySelector('input')?.focus();
    },
    ArrowDown: () => palette.move(1),
    ArrowUp: () => palette.move(-1),
    Enter: () => palette.activate(event.metaKey || event.ctrlKey ? 'download' : 'open'),
    Tab: () => cycleFocus(event),
  };
  const run = actions[event.key];
  if (!run) return;
  event.preventDefault();
  event.stopPropagation();
  run();
}

export function PaletteView() {
  const state = usePalette();
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useVisualHeight(panel, state.open);

  useEffect(() => {
    if (state.open) input.current?.focus();
  }, [state.open, state.nested]);

  if (!state.open) return null;

  return (
    <div
      class="palette-scrim"
      onPointerDown={(e) => e.target === e.currentTarget && palette.close()}
    >
      <div
        ref={panel}
        class="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={handleKey}
      >
        <div class="palette-input">
          {state.nested ? (
            <button
              type="button"
              class="palette-back"
              aria-label="Back to record commands"
              onClick={() => {
                palette.back();
                input.current?.focus();
              }}
            >
              <Icon name="arrow_left" size={18} />
            </button>
          ) : (
            <Icon name="search" size={18} />
          )}
          <input
            ref={input}
            value={state.query}
            placeholder="Search"
            spellcheck={false}
            autocomplete="off"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={
              state.items.length + state.commands.length > 0
                ? `result-${state.selected}`
                : undefined
            }
            onInput={(e) => palette.setQuery((e.target as HTMLInputElement).value)}
          />
          <button
            type="button"
            class="palette-close"
            aria-label="Close"
            onClick={() => palette.close()}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <PaletteResults state={state} />
      </div>
    </div>
  );
}
