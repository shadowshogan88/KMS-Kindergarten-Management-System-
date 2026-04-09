import { useEffect, useRef, useState } from 'react';

const PdfJsViewer = ({ url }) => {
  const rootRef = useRef(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const root = rootRef.current;
    if (!root) return () => {};
    root.innerHTML = '';

    if (!url) return () => {};

    const run = async () => {
      setIsLoading(true);
      setError('');
      try {
        let pdfjs;
        try {
          // pdfjs-dist v4/v5 ESM build (recommended for Vite)
          pdfjs = await import('pdfjs-dist/build/pdf.mjs');
        } catch {
          // older builds
          pdfjs = await import('pdfjs-dist/build/pdf');
        }

        let workerUrl = '';
        try {
          workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
        } catch {
          try {
            workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
          } catch {
            workerUrl = (await import('pdfjs-dist/build/pdf.worker?url')).default;
          }
        }

        if (!workerUrl) throw new Error('PDF worker not found. Ensure pdfjs-dist is installed.');
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const loadingTask = pdfjs.getDocument(url);
        const pdf = await loadingTask.promise;
        if (!isMounted) return;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          const page = await pdf.getPage(pageNum);
          if (!isMounted) return;
          const viewport = page.getViewport({ scale: 1.25 });

          const canvas = document.createElement('canvas');
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = 'w-full rounded-md border border-default-200 bg-white';

          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          const wrapper = document.createElement('div');
          wrapper.className = 'mb-4';
          wrapper.appendChild(canvas);
          root.appendChild(wrapper);
        }
      } catch (e) {
        if (!isMounted) return;
        const msg = e instanceof Error ? e.message : 'Failed to render PDF.';
        if (msg.toLowerCase().includes('pdfjs-dist')) {
          setError('PDF.js dependency missing. Run `npm.cmd install` in `frontend/` and restart `npm.cmd run dev`.');
        } else {
          setError(msg);
        }
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [url]);

  return (
    <div>
      {isLoading ? <div className="text-sm text-default-500">Rendering PDF...</div> : null}
      {error ? <div className="mt-2 text-sm text-danger">{error}</div> : null}
      <div ref={rootRef} />
    </div>
  );
};

export default PdfJsViewer;
