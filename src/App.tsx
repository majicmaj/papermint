import { useEffect, useRef } from 'preact/hooks';
import { ResizeHandles } from './shell/ResizeHandles';
import { IntakePanel } from './components/IntakePanel';
import { DropZone, Toast } from './components/Overlays';
import { DialogHost } from './components/ConfirmDelete';
import { PaletteView } from './components/PaletteView';
import { FavoriteEditor, FavoriteMenu } from './components/FavoriteEditor';
import { TagEditor } from './components/TagEditor';
import { TagMenu } from './components/TagMenu';
import { anyLayerOpen, useModalOpen } from './state/modal';
import { RecordList } from './components/RecordList';
import { RecordPane } from './components/RecordPane';
import { Rail } from './components/Rail';
import { startModality } from './motion/modality';
import { RecordSheet } from './mobile/RecordSheet';
import { BottomBar } from './mobile/BottomBar';
import { useMobile } from './mobile/viewport';
import { VIEW_PATH, type ViewName } from './domain/views';
import { openPalette, palette } from './state/actions';
import { loadIndex } from './state/app';
import { currentRoute, navigate, useRoute, type Route } from './state/router';

// Who acted last, the keyboard or a pointer, from the first interaction on: keys never animate.
startModality();

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
}

function useGlobalKeys(route: Route, view: ViewName): void {
  // Read at key time, not from the effect's closure: effects run after a frame, and a View
  // Transition pauses frames, so a closure can still hold the previous route.
  const current = useRef({ route, view });
  current.current = { route, view };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const route = currentRoute();
      const { view } = current.current;
      if (event.defaultPrevented) return;
      // One guard for every layer: palette, dialog or menu open means no page shortcuts.
      if (anyLayerOpen()) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openPalette();
      } else if (event.key === '/' && !isEditable(event.target) && !event.metaKey) {
        event.preventDefault();
        openPalette();
      } else if (
        event.key === 'Escape' &&
        (route.name === 'record' || route.name === 'file') &&
        !palette.getState().open
      ) {
        if (!(event.target as HTMLElement).closest('[role="menu"], [role="alertdialog"]')) {
          navigate(VIEW_PATH[view]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function activeView(route: Route): ViewName {
  if (route.name === 'file') return route.from ?? 'recovery';
  if (route.name === 'record') return route.from ?? 'records';
  return route.name;
}

export function App() {
  const route = useRoute();
  const view = activeView(route);
  useEffect(() => void loadIndex(), []);
  const covered = useModalOpen();
  const mobile = useMobile();
  useGlobalKeys(route, view);
  return (
    <>
      <div
        class="shell"
        role="main"
        data-pane={route.name === 'record' || route.name === 'file' ? 'record' : 'list'}
        // While the palette is open, nothing behind it takes focus or clicks.
        {...({ inert: covered } as object)}
      >
        {!mobile && <Rail active={view} />}
        <section class="list-col">
          <RecordList view={view} route={route} />
        </section>
        {/* On a phone the record is a sheet over the list, not a column. */}
        {!mobile && (
          <section class="pane-col">
            <RecordPane route={route} />
          </section>
        )}
        {mobile && <BottomBar />}
        {!mobile && <ResizeHandles showList={route.name === 'record' || route.name === 'file'} />}
        <IntakePanel />
      </div>
      {mobile && <RecordSheet route={route} view={view} />}
      <PaletteView />
      <DialogHost />
      <TagMenu />
      <TagEditor />
      <FavoriteMenu />
      <FavoriteEditor />
      <DropZone />
      <Toast />
    </>
  );
}
