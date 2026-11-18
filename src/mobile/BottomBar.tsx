import { runtimeConfig } from '../config/runtime';
import { Icon } from '../icons/Icon';
import { openPalette, pickFiles } from '../state/actions';
import { useModalOpen } from '../state/modal';
import { raiseKeyboard } from './keyboard';

/**
 * The phone's floating bar: a Search capsule and a round Upload button. The list scrolls under
 * it. It steps aside while a sheet, the palette or a dialog covers the page.
 */
export function BottomBar() {
  const covered = useModalOpen();
  return (
    <nav class="bottombar" aria-label="Main" data-hidden={covered ? 'true' : undefined}>
      <button
        type="button"
        class="bottombar-search"
        onClick={() => {
          openPalette();
          raiseKeyboard();
        }}
      >
        <Icon name="search" size={20} />
        Search
      </button>
      <button
        type="button"
        class="bottombar-upload"
        aria-label="Upload"
        disabled={runtimeConfig().readOnly}
        onClick={pickFiles}
      >
        <Icon name="upload" size={22} />
      </button>
    </nav>
  );
}
