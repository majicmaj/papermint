import { useEffect, useRef, useState } from 'preact/hooks';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * Phone browsers (Chrome on Android, Safari on iOS) do not show a PDF inside a frame: Android
 * shows an "Open" button that cannot open an object URL, and iOS shows only the first page.
 * There, pdf.js draws each page on a canvas. Desktop browsers keep their own PDF viewer.
 */
export function needsPdfRenderer(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (navigator.pdfViewerEnabled === false) return true;
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

type LoadingTask = { promise: Promise<PDFDocumentProxy>; destroy(): Promise<void> };

async function openPdf(blob: Blob): Promise<LoadingTask> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await blob.arrayBuffer());
  return pdfjs.getDocument({ data, enableXfa: false });
}

function Page({ pdf, number, width }: { pdf: PDFDocumentProxy; number: number; width: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.294);
  const [visible, setVisible] = useState(number === 1);

  useEffect(() => {
    const node = canvas.current;
    if (!node || visible) return;
    const seen = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setVisible(true),
      { rootMargin: '600px 0px' },
    );
    seen.observe(node);
    return () => seen.disconnect();
  }, [visible]);

  useEffect(() => {
    let cancel = () => {};
    let stopped = false;
    (async () => {
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      if (stopped) return;
      setRatio(base.height / base.width);
      const node = canvas.current;
      if (!visible || !node || width <= 0) return;
      const scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, 3);
      const viewport = page.getViewport({ scale });
      node.width = Math.floor(viewport.width);
      node.height = Math.floor(viewport.height);
      const task = page.render({ canvas: node, viewport });
      cancel = () => task.cancel();
      await task.promise;
    })().catch(() => {});
    return () => {
      stopped = true;
      cancel();
    };
  }, [pdf, number, width, visible]);

  return (
    <canvas
      ref={canvas}
      class="pdf-page"
      style={{ width: `${width}px`, height: `${Math.round(width * ratio)}px` }}
      aria-label={`Page ${number}`}
    />
  );
}

/** All pages of a PDF, as wide as the pane, drawn when they come near the screen. */
export function PdfPages({
  blob,
  title,
  onFail,
}: {
  blob: Blob;
  title: string;
  onFail: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let task: LoadingTask | null = null;
    let stopped = false;
    (async () => {
      task = await openPdf(blob);
      if (stopped) return void task.destroy();
      const opened = await task.promise;
      if (!stopped) setPdf(opened);
    })().catch(() => !stopped && onFail());
    return () => {
      stopped = true;
      void task?.destroy();
    };
  }, [blob]);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(0, node.clientWidth - 24));
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    return () => resize.disconnect();
  }, []);

  return (
    <div ref={box} class="preview-scroll pdf-pages" role="document" aria-label={title}>
      {pdf &&
        width > 0 &&
        Array.from({ length: pdf.numPages }, (_, i) => (
          <Page key={i} pdf={pdf} number={i + 1} width={width} />
        ))}
    </div>
  );
}
