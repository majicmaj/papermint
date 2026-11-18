import { useEffect, useRef, useState } from 'preact/hooks';
import { modality } from '../motion/modality';
import { exitDelay, usePresence } from '../motion/presence';
import { Icon } from '../icons/Icon';
import { useApp } from '../state/app';
import { uploadFiles } from '../state/uploads';
import { navigate } from '../state/router';

const EXIT_MS = 260;

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

/** Drop anywhere. A fixed overlay shows while dragging; it never touches layout. */
export function DropZone() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setActive(true);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      void uploadFiles(files);
      navigate('/pending');
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);
  if (!active) return null;
  return (
    <div class="dropzone" aria-hidden="true">
      <Icon name="upload" size={28} />
    </div>
  );
}

/** The toast stays mounted while it leaves, so it exits the way it came in. */
export function Toast() {
  const notice = useApp((s) => s.notice);
  const last = useRef(notice);
  if (notice) last.current = notice;
  const state = usePresence(notice !== null, () => exitDelay(modality(), EXIT_MS));
  if (state === 'closed') return null;
  return (
    <div class="toast" role="status" data-state={state}>
      {last.current}
    </div>
  );
}
