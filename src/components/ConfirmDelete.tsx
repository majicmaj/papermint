import { useEffect, useRef } from 'preact/hooks';
import { VIEW_PATH, viewFor } from '../domain/views';
import { closeDialog, useDialog } from '../state/dialog';
import { deleteRecord, useApp } from '../state/app';
import { navigate, routeStore } from '../state/router';

interface Props {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Keeps focus inside the dialog: Tab cycles between its buttons. */
function trapKeys(event: KeyboardEvent, root: HTMLElement | null): void {
  event.stopPropagation();
  if (event.key !== 'Tab' || !root) return;
  const buttons = Array.from(root.querySelectorAll<HTMLElement>('button'));
  if (buttons.length === 0) return;
  const at = buttons.indexOf(document.activeElement as HTMLElement);
  const next = (at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
  event.preventDefault();
  buttons[next]?.focus();
}

export function ConfirmDelete({ title, onCancel, onConfirm }: Props) {
  const cancel = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  return (
    <div
      class="dialog-scrim"
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
        trapKeys(e, dialog.current);
      }}
    >
      <div
        ref={dialog}
        class="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete record"
      >
        <p class="dialog-title">Delete “{title}”?</p>
        <div class="dialog-actions">
          <button ref={cancel} type="button" class="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" class="btn btn--danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/** Renders the open dialog outside the page, so the page behind can be inert. */
export function DialogHost() {
  const dialog = useDialog();
  const docs = useApp((s) => s.docs);
  const model = useApp((s) => s.model);
  if (!dialog) return null;
  const confirm = () => {
    closeDialog();
    // Leave the record only if the user is still looking at the one being deleted.
    const route = routeStore.get().route;
    if (route.name === 'record' && route.id === dialog.docId) {
      const doc = docs.find((d) => d.id === dialog.docId);
      const home = route.from ?? (doc ? viewFor(doc, model) : 'records');
      navigate(VIEW_PATH[home], { replace: true });
    }
    void deleteRecord(dialog.docId);
  };
  return <ConfirmDelete title={dialog.title} onCancel={closeDialog} onConfirm={confirm} />;
}
