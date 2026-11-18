import type { ComponentChildren } from 'preact';
import { Icon } from '../icons/Icon';
import { usePaneBar } from './pane-width';

export interface FrameProps {
  title: ComponentChildren;
  meta: ComponentChildren;
  status?: ComponentChildren;
  /** Changes when the status slot changes size, so the slot is replaced, not resized. */
  statusKey?: string;
  /** Replaces the title block when the version changes, so its width never resizes in place. */
  titleKey?: string;
  actions: (up: boolean) => ComponentChildren;
  body: ComponentChildren;
  onBack: () => void;
  /** Terminal states show Back on every width. */
  terminal?: boolean;
  children?: ComponentChildren;
}

/**
 * One structure for every record state: the toolbar row (title, marks, status, actions), one
 * fixed-height line of facts at the top of the pane body, the preview, the mobile action bar.
 */
export function Frame({
  title,
  meta,
  status,
  statusKey,
  titleKey,
  actions,
  body,
  onBack,
  terminal,
  children,
}: FrameProps) {
  const bar = usePaneBar();
  return (
    <div class={`pane${terminal ? ' pane--terminal' : ''}`} data-bar={bar}>
      <header class="pane-head">
        <button
          type="button"
          class="btn btn--icon btn--ghost pane-back"
          aria-label="Back"
          onClick={onBack}
        >
          <Icon name="arrow_left" />
        </button>
        <div class="pane-title" key={titleKey}>
          {title}
        </div>
        <div class="pane-status" key={statusKey}>
          {status}
        </div>
        <div class="pane-actions pane-actions--desktop">{actions(false)}</div>
      </header>
      <div class="pane-body">
        <div class="pane-metarow">
          {meta}
          {!terminal && (
            <button
              type="button"
              class="btn btn--icon btn--ghost pane-close"
              aria-label="Close preview"
              onClick={onBack}
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
        <div class="pane-view">{body}</div>
      </div>
      <footer class="pane-actions pane-actions--mobile">{actions(true)}</footer>
      {children}
    </div>
  );
}
