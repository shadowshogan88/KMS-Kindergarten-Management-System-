import { useEffect, useMemo, useRef, useState } from 'react';
import { LuCheck, LuChevronDown, LuExpand, LuMessageSquareText, LuMinimize2 } from 'react-icons/lu';

import { CKEditor } from '@ckeditor/ckeditor5-react';
import DecoupledEditor from '@ckeditor/ckeditor5-build-decoupled-document';
import 'ckeditor5/ckeditor5.css';

import { apiForm, apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

import './canvasAssignmentEditor.css';

const computeWordCount = html => {
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  const text = (div.textContent || '').trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

const bytesLabel = bytes => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const normalizeKey = v => String(v || '').trim().toLowerCase().replace(/\s+/g, '_').slice(0, 80);

/**
 * Canvas-style assignment submission editor UI (screenshot-like).
 * - Decoupled toolbar in a dedicated top bar
 * - Word-like editing surface
 * - Draft autosave (10s) to localStorage
 * - Text/Upload submission type tiles
 * - Sticky footer (Draft Saved + Submit)
 */
const CanvasAssignmentEditor = ({ assignmentConfig, homeworkId: homeworkIdProp, ensureSubmission = true, onSubmitted } = {}) => {
  const config = useMemo(() => {
    const base = {
      title: 'Module 4 Assignment',
      dueDate: 'Jul 25, 2026',
      points: 10,
      status: 'In Progress',
      nextStep: 'Submit Assignment',
      theme: { primary: '#6f42c1', primary600: '#5b34a6' },
      attempts: [{ id: 1, label: 'Attempt 1' }],
      ui: {
        duePrefix: 'Due:',
        pointsLabel: 'Possible Points',
        feedbackBtn: 'View Feedback',
        chooseTypeTitle: 'Choose a submission type',
        textTab: 'Text',
        uploadTab: 'Upload',
        inProgress: 'IN PROGRESS',
        nextUpPrefix: 'Next Up:',
        previousBtn: 'Previous',
        nextBtn: 'Next',
        draftSaved: 'Draft Saved',
        submitBtn: 'Submit Assignment',
        toolbarBtn: 'Toolbar',
        wordCountSuffix: 'words',
      },
    };
    return { ...base, ...(assignmentConfig || {}), ui: { ...base.ui, ...(assignmentConfig?.ui || {}) } };
  }, [assignmentConfig]);

  const canUseApi = Boolean(authStorage.getAccess());
  const user = authStorage.getUser();
  const role = user?.role || '';
  const isStudent = role === 'STUDENT';

  const homeworkId = useMemo(() => {
    const direct = String(homeworkIdProp ?? '').trim();
    if (direct) return direct;
    try {
      const qs = new URLSearchParams(window.location.search);
      return String(qs.get('homework') || qs.get('homeworkId') || '').trim();
    } catch {
      return '';
    }
  }, [homeworkIdProp]);

  const storageKey = useMemo(() => `kms.canvas.assignment_editor.${normalizeKey(config.title) || 'assignment'}`, [config.title]);

  const toolbarHostRef = useRef(null);
  const toolbarSheetRef = useRef(null);
  const editorRef = useRef(null);
  const uploadFilesRef = useRef(new Map());

  const [activeType, setActiveType] = useState('text'); // text | upload
  const [attemptId, setAttemptId] = useState(config.attempts?.[0]?.id || 1);
  const [contentHtml, setContentHtml] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [uploads, setUploads] = useState([]);

  const [submission, setSubmission] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const primary = config.theme?.primary || '#6f42c1';
  const primary600 = config.theme?.primary600 || '#5b34a6';

  useEffect(() => {
    try {
      document.documentElement.style.setProperty('--canvas-primary', primary);
      document.documentElement.style.setProperty('--canvas-primary-600', primary600);
    } catch {}
  }, [primary, primary600]);

  // Load draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (typeof parsed.contentHtml === 'string') setContentHtml(parsed.contentHtml);
      if (typeof parsed.savedAt === 'string') setDraftSavedAt(parsed.savedAt);
      if (Array.isArray(parsed.uploads)) setUploads(parsed.uploads.map(u => ({ ...u, hasFile: false })));
      if (typeof parsed.activeType === 'string') setActiveType(parsed.activeType === 'upload' ? 'upload' : 'text');
      if (parsed.attemptId) setAttemptId(parsed.attemptId);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Autosave every 10 seconds if dirty
  useEffect(() => {
    const t = setInterval(() => {
      if (!isDirty) return;
      try {
        const savedAt = new Date().toISOString();
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            attemptId,
            activeType,
            contentHtml,
            uploads: (Array.isArray(uploads) ? uploads : []).map(u => ({
              id: u?.id,
              name: u?.name,
              size: u?.size,
              type: u?.type,
            })),
            savedAt,
          })
        );
        setDraftSavedAt(savedAt);
        setIsDirty(false);
      } catch {}
    }, 10000);
    return () => clearInterval(t);
  }, [activeType, attemptId, contentHtml, isDirty, storageKey, uploads]);

  // Move toolbar into sheet on mobile open
  useEffect(() => {
    const toolbarEl = editorRef.current?.ui?.view?.toolbar?.element;
    const host = toolbarHostRef.current;
    const sheet = toolbarSheetRef.current;
    if (!toolbarEl) return;
    if (isToolbarOpen && sheet) {
      sheet.innerHTML = '';
      sheet.appendChild(toolbarEl);
      return;
    }
    if (!isToolbarOpen && host) {
      host.innerHTML = '';
      host.appendChild(toolbarEl);
    }
  }, [isToolbarOpen]);

  const words = useMemo(() => computeWordCount(contentHtml), [contentHtml]);
  const savedLabel = draftSavedAt ? `${config.ui.draftSaved} • ${draftSavedAt.slice(11, 16)}` : config.ui.draftSaved;
  const isLocked = submission?.status === 'SUBMITTED' || submission?.status === 'GRADED';
  const canEdit = isStudent && !isLocked;

  const addUploads = files => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const mapped = list.map(f => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      try {
        uploadFilesRef.current.set(id, f);
      } catch {}
      return { id, name: f.name, size: f.size, type: f.type, hasFile: true };
    });
    setUploads(prev => [...prev, ...mapped]);
    setIsDirty(true);
  };

  const removeUpload = id => {
    try {
      uploadFilesRef.current.delete(String(id));
    } catch {}
    setUploads(prev => prev.filter(u => String(u.id) !== String(id)));
    setIsDirty(true);
  };

  const loadSubmission = async ({ ensure = false } = {}) => {
    if (!canUseApi || !isStudent || !homeworkId) return null;
    const list = await apiJson(`/submissions/?homework=${encodeURIComponent(homeworkId)}`);
    const rows = Array.isArray(list?.results) ? list.results : Array.isArray(list) ? list : [];
    let sub = rows[0] || null;
    if (!sub && ensure) {
      sub = await apiJson('/submissions/', { method: 'POST', body: { homework: Number(homeworkId) || homeworkId } });
    }
    if (!sub?.id) return null;
    return await apiJson(`/submissions/${encodeURIComponent(sub.id)}/`);
  };

  useEffect(() => {
    setError('');
    setFlash('');
    if (!canUseApi || !isStudent || !homeworkId) return;
    loadSubmission({ ensure: false })
      .then(s => setSubmission(s))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load submission.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseApi, isStudent, homeworkId]);

  const submit = async () => {
    setError('');
    setFlash('');

    if (!canUseApi) return setError('Please sign in to submit.');
    if (!isStudent) return setError('Only students can submit.');
    if (!homeworkId) return setError('Missing homework id. Add `?homework=<id>` in the URL (or pass `homeworkId` prop).');
    if (isLocked) return setError('Submission is already locked.');

    const hasText = computeWordCount(contentHtml) > 0;
    const pendingUploads = (Array.isArray(uploads) ? uploads : []).filter(u => u?.hasFile && uploadFilesRef.current.has(String(u.id)));
    if (!hasText && pendingUploads.length < 1) return setError('Add some text or upload at least one image before submitting.');

    setIsSubmitting(true);
    try {
      const sub = await loadSubmission({ ensure: Boolean(ensureSubmission) });
      if (!sub?.id) throw new Error('Could not create submission.');
      setSubmission(sub);

      if (hasText) {
        await apiJson(`/submissions/${encodeURIComponent(sub.id)}/`, { method: 'PATCH', body: { content_html: contentHtml } });
      }

      if (pendingUploads.length) {
        for (const u of pendingUploads) {
          const file = uploadFilesRef.current.get(String(u.id));
          if (!file) continue;
          const formData = new FormData();
          formData.append('submission', String(sub.id));
          formData.append('image', file);
          await apiForm('/submission-images/', { method: 'POST', formData });
          uploadFilesRef.current.delete(String(u.id));
        }
        setUploads([]);
      }

      const res = await apiJson(`/submissions/${encodeURIComponent(sub.id)}/submit/`, { method: 'POST' });
      const refreshed = await apiJson(`/submissions/${encodeURIComponent(sub.id)}/`);
      setSubmission(refreshed);

      setFlash(res?.is_late_submission ? 'Submitted (late).' : 'Submitted.');
      setIsDirty(false);
      try {
        localStorage.removeItem(storageKey);
      } catch {}

      if (typeof onSubmitted === 'function') {
        try {
          onSubmitted({ submission: refreshed, result: res });
        } catch {}
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`canvas-page ${isFullscreen ? 'fixed inset-0 z-[9999] overflow-auto' : ''}`}>
      {/* Top header */}
      <div className="bg-white border-b border-default-200">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-wrap gap-3 items-start justify-between">
            <div className="min-w-0">
              <div className="text-xl md:text-2xl font-semibold text-default-900 truncate">{config.title}</div>
              <div className="text-sm text-default-600 mt-1">
                {config.ui.duePrefix} <span className="font-medium">{config.dueDate}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xl md:text-2xl font-semibold text-default-900">
                {config.points} <span className="text-sm font-normal text-default-600">{config.ui.pointsLabel}</span>
              </div>
              <button type="button" className="btn btn-sm bg-default-100 text-default-800 mt-2">
                <LuMessageSquareText className="inline size-4" /> {config.ui.feedbackBtn}
              </button>
            </div>
          </div>
        </div>
        <div className="canvas-divider" />

        {/* Attempt + status row */}
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative">
                <select
                  className="form-select w-44 pr-9"
                  value={attemptId}
                  onChange={e => setAttemptId(Number(e.target.value) || 1)}
                  disabled={!canEdit || isSubmitting}
                >
                  {(config.attempts || []).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.label || `Attempt ${a.id}`}
                    </option>
                  ))}
                </select>
                <LuChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-default-500 size-4 pointer-events-none" />
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#16a34a' }}>
                  <span className="inline-block size-3 rounded-full border-2 border-green-600 bg-white" />
                  {config.ui.inProgress}
                </span>
                <span className="text-sm text-default-600">
                  {config.ui.nextUpPrefix} <span className="font-medium text-default-800">{config.nextStep}</span>
                </span>
              </div>
            </div>

            <button type="button" className="btn btn-sm bg-default-100 text-default-800" onClick={() => setIsFullscreen(v => !v)}>
              {isFullscreen ? <LuMinimize2 className="inline size-4" /> : <LuExpand className="inline size-4" />}{' '}
              {isFullscreen ? 'Exit full screen' : 'Full screen'}
            </button>
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-5">
        <div className="canvas-card p-4 md:p-5">
          <div className="text-sm text-default-700 mb-3">{config.ui.chooseTypeTitle}</div>
          {flash ? <div className="mb-3 text-sm text-success">{flash}</div> : null}
          {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
          {!homeworkId ? <div className="mb-3 text-xs text-default-500">Tip: to submit to API, open this page with `?homework=&lt;id&gt;`.</div> : null}

          {/* Submission type tiles */}
          <div className="flex gap-3 mb-4">
            <button
              type="button"
              onClick={() => setActiveType('text')}
              disabled={!canEdit || isSubmitting}
              className={`w-28 h-24 rounded-md border flex flex-col items-center justify-center gap-1 ${
                activeType === 'text' ? 'border-transparent' : 'border-default-200'
              }`}
              style={activeType === 'text' ? { background: primary, color: '#fff' } : {}}
            >
              <div className="text-3xl font-extrabold leading-none">T</div>
              <div className="text-sm font-medium">{config.ui.textTab}</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveType('upload')}
              disabled={!canEdit || isSubmitting}
              className={`w-28 h-24 rounded-md border flex flex-col items-center justify-center gap-1 ${
                activeType === 'upload' ? 'border-transparent' : 'border-default-200'
              }`}
              style={activeType === 'upload' ? { background: primary, color: '#fff' } : {}}
            >
              <div className="text-3xl font-extrabold leading-none">↑</div>
              <div className="text-sm font-medium">{config.ui.uploadTab}</div>
            </button>
          </div>

          {/* Text editor */}
          {activeType === 'text' ? (
            <div className="canvas-editor-shell">
              <div className="border-b border-default-200 pb-2 mb-3">
                <div ref={toolbarHostRef} className="min-w-0 overflow-x-auto" />
                <div className="md:hidden mt-2">
                  <button type="button" className="btn btn-sm bg-default-100 text-default-800 w-full" onClick={() => setIsToolbarOpen(true)}>
                    {config.ui.toolbarBtn}
                  </button>
                </div>
              </div>

                <CKEditor
                  editor={DecoupledEditor}
                  data={contentHtml}
                  disabled={!canEdit || isSubmitting}
                  config={{
                    toolbar: {
                      items: [
                        'undo',
                        'redo',
                        '|',
                        'heading',
                        '|',
                        'bold',
                        'italic',
                        'link',
                        '|',
                        'bulletedList',
                        'numberedList',
                      ],
                    },
                  }}
                  onReady={editor => {
                    editorRef.current = editor;
                  const toolbarEl = editor?.ui?.view?.toolbar?.element;
                  const host = toolbarHostRef.current;
                  if (toolbarEl && host) {
                    host.innerHTML = '';
                    host.appendChild(toolbarEl);
                  }
                }}
                onChange={(_, editor) => {
                  const data = editor.getData();
                  setContentHtml(data);
                  setIsDirty(true);
                }}
              />

              <div className="mt-3 flex items-center justify-between text-sm text-default-600">
                <div>
                  {words} {config.ui.wordCountSuffix}
                </div>
                <div className="flex items-center gap-2">
                  {draftSavedAt && !isDirty ? <LuCheck className="size-4 text-success" /> : null}
                  <span>{isDirty ? 'Unsaved changes' : savedLabel}</span>
                </div>
              </div>

              <div className="mt-4 flex justify-between">
                <button type="button" className="btn btn-sm bg-default-100 text-default-800">
                  {config.ui.previousBtn}
                </button>
                <button type="button" className="btn btn-sm bg-default-100 text-default-800">
                  {config.ui.nextBtn}
                </button>
              </div>
            </div>
          ) : null}

          {/* Upload tab */}
          {activeType === 'upload' ? (
            <div className="rounded-md border border-default-200 p-3">
              <input
                className="form-input w-full"
                type="file"
                accept="image/*"
                multiple
                disabled={!canEdit || isSubmitting}
                onChange={e => addUploads(e.target.files)}
              />
              <div className="mt-3 grid grid-cols-1 gap-2">
                {!uploads.length ? <div className="text-sm text-default-500">No files selected.</div> : null}
                {uploads.map(u => (
                  <div key={u.id} className="flex items-start justify-between gap-2 rounded-md border border-default-200 p-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                      <div className="text-xs text-default-500">
                        {bytesLabel(u.size)} • {u.type || 'file'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm bg-default-100 text-default-800"
                      onClick={() => removeUpload(u.id)}
                      disabled={!canEdit || isSubmitting}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-20 border-t border-default-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-sm text-default-600 flex items-center gap-2">
            {draftSavedAt && !isDirty ? <LuCheck className="size-4 text-success" /> : null}
            <span>{isDirty ? 'Unsaved changes' : savedLabel}</span>
          </div>
          <button
            type="button"
            className="btn text-white"
            style={{ background: primary }}
            onClick={submit}
            disabled={isSubmitting || !canEdit || !homeworkId}
          >
            {config.ui.submitBtn}
          </button>
        </div>
      </div>

      {/* Mobile toolbar sheet */}
      {isToolbarOpen ? (
        <div className="fixed inset-0 z-[10000] bg-black/40" onClick={() => setIsToolbarOpen(false)} role="presentation">
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-xl border-t border-default-200 p-3"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-semibold text-default-900">{config.ui.toolbarBtn}</div>
              <button type="button" className="btn btn-sm bg-default-100 text-default-800" onClick={() => setIsToolbarOpen(false)}>
                Close
              </button>
            </div>
            <div ref={toolbarSheetRef} className="overflow-x-auto" />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CanvasAssignmentEditor;
