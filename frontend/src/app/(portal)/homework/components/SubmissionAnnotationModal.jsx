import { useEffect, useMemo, useRef, useState } from 'react';
import { LuEraser, LuSave, LuX } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage, getApiBaseUrl } from '@/utils/auth';
import { closeOverlay } from '@/utils/overlay';

const MODAL_ID = '#submission-annotate-modal';

const resolveApiUrl = maybeRelative => {
  if (!maybeRelative) return '';
  const s = String(maybeRelative);
  if (/^https?:\/\//i.test(s) || s.startsWith('blob:')) return s;
  const base = getApiBaseUrl();
  if (s.startsWith('/')) return `${base}${s}`;
  return `${base}/${s}`;
};

const normalizeStrokeWidth = v => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 2;
  return Math.max(1, Math.min(14, n));
};

const toPairs = points => (Array.isArray(points) ? points.filter(p => Array.isArray(p) && p.length >= 2) : []);

const emptyData = () => ({ version: 1, text: '', strokes: [] });

const parseData = raw => {
  if (!raw || typeof raw !== 'object') return emptyData();
  const strokes = Array.isArray(raw.strokes) ? raw.strokes : [];
  return {
    version: 1,
    text: typeof raw.text === 'string' ? raw.text : '',
    strokes: strokes
      .filter(s => s && typeof s === 'object' && Array.isArray(s.points))
      .map(s => ({
        color: typeof s.color === 'string' ? s.color : '#ef4444',
        width: normalizeStrokeWidth(s.width),
        points: toPairs(s.points).map(p => [Number(p[0]) || 0, Number(p[1]) || 0]),
      })),
  };
};

const getCanvasPoint = (e, canvas) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / Math.max(1, rect.width);
  const y = (e.clientY - rect.top) / Math.max(1, rect.height);
  return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
};

const drawAll = ({ canvas, strokes }) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const s of strokes) {
    if (!s?.points?.length) continue;
    ctx.strokeStyle = s.color || '#ef4444';
    ctx.lineWidth = normalizeStrokeWidth(s.width);
    ctx.beginPath();
    const [x0, y0] = s.points[0];
    ctx.moveTo(x0 * canvas.width, y0 * canvas.height);
    for (let i = 1; i < s.points.length; i += 1) {
      const [x, y] = s.points[i];
      ctx.lineTo(x * canvas.width, y * canvas.height);
    }
    ctx.stroke();
  }
};

const closeAnnotateOverlay = () => closeOverlay(MODAL_ID);

const SubmissionAnnotationModal = ({ image, onSaved }) => {
  const user = authStorage.getUser();
  const imageId = image?.id;
  const isOpen = useMemo(() => Boolean(imageId), [imageId]);

  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [annotationId, setAnnotationId] = useState(null);
  const [text, setText] = useState('');
  const [color, setColor] = useState('#ef4444');
  const [width, setWidth] = useState(3);
  const [strokes, setStrokes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const pageLabel = image?.page_number ? `Page #${image.page_number}` : imageId ? `Image #${imageId}` : '';

  const fitCanvas = () => {
    const canvas = canvasRef.current;
    const imgEl = imgRef.current;
    if (!canvas || !imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    const nextW = Math.max(320, Math.floor(rect.width));
    const nextH = Math.max(240, Math.floor(rect.height));
    if (canvas.width !== nextW) canvas.width = nextW;
    if (canvas.height !== nextH) canvas.height = nextH;
    drawAll({ canvas, strokes });
  };

  useEffect(() => {
    if (!isOpen) return () => {};
    const onResize = () => fitCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, strokes]);

  useEffect(() => {
    setError('');
    setAnnotationId(null);
    setText('');
    setColor('#ef4444');
    setWidth(3);
    setStrokes([]);
    setIsDrawing(false);
  }, [imageId]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (!imageId || !user?.id) return;
      setIsLoading(true);
      setError('');
      try {
        const data = await apiJson(`/annotations/?submission_image=${encodeURIComponent(imageId)}`);
        const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        const mine = rows.find(
          a => String(a.created_by) === String(user.id) && String(a.submission_image) === String(imageId)
        );
        if (!isMounted) return;
        if (mine?.id) {
          setAnnotationId(mine.id);
          const parsed = parseData(mine.annotation_data);
          setText(parsed.text);
          setStrokes(parsed.strokes);
        }
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load annotation.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [imageId, user?.id]);

  useEffect(() => {
    fitCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, imageId]);

  const startDraw = e => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(e.pointerId);
    const [x, y] = getCanvasPoint(e, canvas);
    setStrokes(prev => [...prev, { color, width: normalizeStrokeWidth(width), points: [[x, y]] }]);
    setIsDrawing(true);
  };

  const moveDraw = e => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing) return;
    const [x, y] = getCanvasPoint(e, canvas);
    setStrokes(prev => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last) return prev;
      last.points = [...(last.points || []), [x, y]];
      next[next.length - 1] = last;
      return next;
    });
  };

  const endDraw = () => setIsDrawing(false);

  const clear = () => {
    setStrokes([]);
    const canvas = canvasRef.current;
    if (canvas) drawAll({ canvas, strokes: [] });
  };

  const save = async () => {
    if (!imageId) return;
    setError('');
    setIsSaving(true);
    try {
      const payload = { version: 1, text, strokes };
      if (annotationId) {
        await apiJson(`/annotations/${annotationId}/`, { method: 'PATCH', body: { annotation_data: payload } });
      } else {
        const created = await apiJson('/annotations/', { method: 'POST', body: { submission_image: imageId, annotation_data: payload } });
        setAnnotationId(created?.id || null);
      }
      await onSaved?.({
        message: pageLabel ? `Annotation saved for ${pageLabel}.` : 'Annotation saved.',
        imageId,
        annotation_data: payload,
      });
      closeAnnotateOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save annotation.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id={MODAL_ID.slice(1)}
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none hs-overlay-open:pointer-events-auto"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="submission-annotate-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-4xl sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="submission-annotate-modal-label" className="font-bold text-default-800 text-base">
              Annotate Page
            </h3>
            {pageLabel ? <div className="mt-1 text-xs text-default-500">{pageLabel}</div> : null}
            <div>
              <button
                type="button"
                className="size-5 text-default-800"
                aria-label="Close"
                data-hs-overlay={MODAL_ID}
                onClick={closeAnnotateOverlay}
                disabled={isSaving}
              >
                <span className="sr-only">Close</span>
                <LuX className="size-5" />
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto">
            {error ? (
              <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            {isLoading ? <div className="text-sm text-default-500">Loading...</div> : null}

            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-default-600">Color</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} disabled={isSaving} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-default-600">Pen</label>
                <input type="range" min="1" max="14" value={width} onChange={e => setWidth(Number(e.target.value))} disabled={isSaving} />
                <span className="text-xs text-default-600 w-6">{width}</span>
              </div>
              <button type="button" className="btn btn-sm bg-default-200" onClick={clear} disabled={isSaving}>
                <LuEraser className="inline size-4" /> Clear
              </button>
            </div>

            <div className="rounded-lg border border-default-200 bg-default-50 p-2">
              <div className="relative w-full">
                <img
                  ref={imgRef}
                  src={resolveApiUrl(image?.image)}
                  alt="Submission page"
                  className="w-full rounded-md border border-default-200 bg-white"
                  onLoad={fitCanvas}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                  style={{ touchAction: 'none' }}
                  onPointerDown={startDraw}
                  onPointerMove={moveDraw}
                  onPointerUp={endDraw}
                  onPointerCancel={endDraw}
                  onPointerLeave={endDraw}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="inline-block mb-2 text-sm font-medium">Note (optional)</label>
              <textarea
                className="form-input w-full min-h-24"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Write a short note for this page..."
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="flex justify-end items-center gap-x-2 py-3 px-4">
            <button
              data-hs-overlay={MODAL_ID}
              onClick={closeAnnotateOverlay}
              className="bg-transparent text-danger btn border-0 hover:bg-danger/10"
              aria-label="Close"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button type="button" className="text-white btn bg-primary" onClick={save} disabled={isSaving || !imageId}>
              <LuSave className="inline size-4" /> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmissionAnnotationModal;
