import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import DocumentEditor from '@/components/DocumentEditor';
import { apiForm, apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const formatDateTime = value => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
};

const computeWordCount = html => {
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  const text = (div.textContent || '').trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

const emptyForm = {
  title: '',
  short_description: '',
  classroom: '',
  subject: '',
  class_date: '',
  due_date: '',
  allow_late_submission: false,
  content_mode: 'TEXT',
  description: '',
  status: 'DRAFT',
};

const HomeworkCreate = ({ homeworkType = 'HOMEWORK', pageTitle = 'Create Homework' } = {}) => {
  const canUseApi = Boolean(authStorage.getAccess());
  const user = authStorage.getUser();
  const role = user?.role || '';
  const [searchParams] = useSearchParams();
  const homeworkId = (searchParams.get('id') || '').trim();
  const pageMode = ((searchParams.get('mode') || '').trim().toLowerCase() || 'create');
  const isViewMode = Boolean(homeworkId) && pageMode === 'view';
  const isEditMode = Boolean(homeworkId) && pageMode === 'edit';
  const isCreateMode = !homeworkId;
  const isLocked = isViewMode;

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [draftStatus, setDraftStatus] = useState('Draft not saved yet');
  const [draftAvailable, setDraftAvailable] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoadingItem, setIsLoadingItem] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  const formRef = useRef(form);
  const pdfFileNameRef = useRef(pdfFileName);

  const noun = homeworkType === 'ASSIGNMENT' ? 'Assignment' : 'Homework';
  const listRoute = homeworkType === 'ASSIGNMENT' ? '/portal/assignment' : '/portal/homework';
  const createRoute = homeworkType === 'ASSIGNMENT' ? '/portal/assignment/create' : '/portal/homework/create';
  const isPrivilegedEditor = role === 'ADMIN' || role === 'TEACHER';
  const keepSelectionLocked = !(homeworkType === 'ASSIGNMENT' && isEditMode && isPrivilegedEditor);
  const pageHeading = isViewMode ? `View ${noun}` : isEditMode ? `Edit ${noun}` : pageTitle;

  useEffect(() => {
    return () => {
      if (!pdfPreviewUrl || !pdfPreviewUrl.startsWith('blob:')) return;
      try {
        URL.revokeObjectURL(pdfPreviewUrl);
      } catch {}
    };
  }, [pdfPreviewUrl]);

  const baseDraftKey = useMemo(() => `kms.homework.create.${homeworkType}.draft`, [homeworkType]);
  const draftScope = useMemo(() => {
    const classroom = String(form.classroom || '').trim();
    const subject = String(form.subject || '').trim();
    const classDate = String(form.class_date || '').trim();
    const dueDate = String(form.due_date || '').trim();
    const effectiveDate = classDate || (dueDate ? dueDate.slice(0, 10) : '');

    if (!classroom && !subject && !effectiveDate) {
      return { key: baseDraftKey, label: 'General' };
    }

    const scopeId = [classroom || '_', subject || '_', effectiveDate || '_'].map(v => encodeURIComponent(v)).join('|');
    const labelParts = [];
    if (classroom) labelParts.push(`Class ${classroom}`);
    if (subject) labelParts.push(`Subject ${subject}`);
    if (effectiveDate) labelParts.push(`Date ${effectiveDate}`);
    return { key: `${baseDraftKey}.${scopeId}`, label: labelParts.join(' | ') || 'Scoped' };
  }, [baseDraftKey, form.class_date, form.classroom, form.due_date, form.subject]);
  const draftKey = draftScope.key;
  const classroomLabel = useMemo(() => {
    const raw = String(form.classroom || '').trim();
    if (!raw) return '-';
    const found = classes.find(opt => String(opt?.value) === raw);
    if (found?.label) return found.label;
    const [classId, section] = raw.split(':', 2);
    return section ? `${classId} (${section})` : classId;
  }, [classes, form.classroom]);
  const subjectLabel = useMemo(() => {
    const current = subjects.find(s => String(s?.id) === String(form.subject));
    if (current) return `${current.code} - ${current.name}`;
    return String(form.subject || '-');
  }, [form.subject, subjects]);
  const detailItems = useMemo(() => ([
    { label: 'Title', value: form.title || '-' },
    { label: 'Short Description', value: form.short_description || '-' },
    { label: 'Classroom', value: classroomLabel },
    { label: 'Subject', value: subjectLabel },
    { label: 'Class Date', value: form.class_date || '-' },
    { label: 'Due Date', value: formatDateTime(form.due_date) },
    { label: 'Type', value: noun },
    { label: 'Status', value: form.status || '-' },
    { label: 'Allow Late Submission', value: form.allow_late_submission ? 'Yes' : 'No' },
    { label: 'Content', value: form.content_mode === 'PDF' ? 'PDF' : 'Text' },
    { label: 'PDF File', value: pdfFileName || '-' },
    { label: 'Word Count', value: form.content_mode === 'TEXT' ? String(computeWordCount(form.description)) : '0' },
  ]), [
    classroomLabel,
    form.allow_late_submission,
    form.class_date,
    form.content_mode,
    form.description,
    form.due_date,
    form.short_description,
    form.status,
    form.title,
    noun,
    pdfFileName,
    subjectLabel,
  ]);

  const submitLabel = useMemo(() => {
    if (isViewMode) return `View ${noun}`;
    if (isEditMode) return form.status === 'PUBLISHED' ? `Update & Keep ${noun} Active` : `Update ${noun} Draft`;
    return form.status === 'PUBLISHED' ? `Create & Publish ${noun}` : `Save ${noun} as Draft`;
  }, [form.status, isEditMode, isViewMode, noun]);

  const canSubmit = useMemo(() => {
    if (isViewMode) return false;
    if (!String(form.title || '').trim()) return false;
    if (!String(form.classroom || '').trim()) return false;
    if (!String(form.subject || '').trim()) return false;
    if (!String(form.due_date || '').trim()) return false;
    if (form.content_mode === 'PDF' && isCreateMode && !pdfFile) return false;
    return true;
  }, [form.classroom, form.content_mode, form.due_date, form.subject, form.title, isCreateMode, isViewMode, pdfFile]);

  const loadClasses = async () => {
    const data = await apiJson('/academic-classes/options/');
    setClasses(Array.isArray(data) ? data : []);
  };

  const loadSubjects = async (classId, section) => {
    if (!classId) {
      setSubjects([]);
      return;
    }
    const qs = `?school_class=${encodeURIComponent(classId)}&section=${encodeURIComponent(section || '')}&page=1`;
    const data = await apiJson(`/subjects/${qs}`);
    const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    setSubjects(rows);
  };

  useEffect(() => {
    if (!canUseApi) return;
    loadClasses().catch(() => {});
  }, [canUseApi]);

  useEffect(() => {
    const raw = String(form.classroom || '').trim();
    if (!raw) return;
    const [classId, section] = raw.split(':', 2);
    loadSubjects(classId, section || '').catch(() => {});
  }, [form.classroom]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    pdfFileNameRef.current = pdfFileName;
  }, [pdfFileName]);

  const readDraft = key => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  };

  const applyDraft = parsed => {
    if (!parsed || typeof parsed !== 'object') return;
    setForm(current => ({
      ...current,
      title: typeof parsed.title === 'string' ? parsed.title : current.title,
      short_description: typeof parsed.short_description === 'string' ? parsed.short_description : current.short_description,
      classroom: typeof parsed.classroom === 'string' ? parsed.classroom : current.classroom,
      subject: typeof parsed.subject === 'string' ? parsed.subject : current.subject,
      class_date: typeof parsed.class_date === 'string' ? parsed.class_date : current.class_date,
      due_date: typeof parsed.due_date === 'string' ? parsed.due_date : current.due_date,
      allow_late_submission: Boolean(parsed.allow_late_submission),
      content_mode: parsed.content_mode === 'PDF' ? 'PDF' : 'TEXT',
      description: typeof parsed.description === 'string' ? parsed.description : current.description,
      status: parsed.status === 'PUBLISHED' ? 'PUBLISHED' : current.status,
    }));
    if (typeof parsed?.pdf_file_name === 'string') setPdfFileName(parsed.pdf_file_name);
    if (parsed?.saved_at) setDraftStatus(`Draft saved | ${String(parsed.saved_at).slice(11, 16)}`);
  };

  const isMeaningfulDraft = parsed => {
    if (!parsed || typeof parsed !== 'object') return false;
    return Boolean(
      String(parsed.title || '').trim() ||
      String(parsed.short_description || '').trim() ||
      String(parsed.description || '').trim() ||
      String(parsed.pdf_file_name || '').trim()
    );
  };

  useEffect(() => {
    if (!isCreateMode) {
      setDraftAvailable(null);
      return;
    }

    const scoped = readDraft(draftKey);
    if (isMeaningfulDraft(scoped)) {
      setDraftAvailable({ key: draftKey, payload: scoped });
      return;
    }

    if (draftKey !== baseDraftKey) {
      const base = readDraft(baseDraftKey);
      if (isMeaningfulDraft(base)) {
        setDraftAvailable({ key: baseDraftKey, payload: base, willMigrateTo: draftKey });
      } else {
        setDraftAvailable(null);
      }
      return;
    }

    setDraftAvailable(null);
  }, [baseDraftKey, draftKey, isCreateMode]);

  useEffect(() => {
    if (!canUseApi || !isCreateMode) return;
    const src = (searchParams.get('src') || '').trim();
    if (src !== 'live-calendar') return;

    const classId = (searchParams.get('class') || '').trim();
    const section = (searchParams.get('section') || '').trim();
    const subjectId = (searchParams.get('subject') || '').trim();
    const classDate = (searchParams.get('class_date') || searchParams.get('date') || '').trim();
    const dueDate = (searchParams.get('due_date') || '').trim();

    const nextClassroom = classId ? `${classId}:${section || ''}` : '';
    const nextDue = dueDate || (classDate ? `${classDate}T23:59` : '');

    setForm(current => ({
      ...current,
      classroom: nextClassroom || current.classroom,
      subject: subjectId || current.subject,
      class_date: classDate || current.class_date,
      due_date: nextDue || current.due_date,
    }));
  }, [canUseApi, isCreateMode, searchParams]);

  useEffect(() => {
    if (!canUseApi || isCreateMode || !homeworkId) return;
    let cancelled = false;

    const loadHomework = async () => {
      setIsLoadingItem(true);
      setError('');
      try {
        const data = await apiJson(`/homeworks/${encodeURIComponent(homeworkId)}/`);
        if (cancelled) return;
        setForm({
          title: data?.title || '',
          short_description: data?.short_description || '',
          classroom: data?.class_name ? `${data.class_name}:${data.section || ''}` : '',
          subject: data?.subject ? String(data.subject) : '',
          class_date: data?.class_date || '',
          due_date: String(data?.due_date || '').slice(0, 16),
          allow_late_submission: Boolean(data?.allow_late_submission),
          content_mode: data?.pdf_file ? 'PDF' : 'TEXT',
          description: data?.description || '',
          status: data?.status || 'DRAFT',
        });
        setPdfFile(null);
        setPdfFileName(data?.pdf_file ? String(data.pdf_file).split('/').pop() || '' : '');
        setPdfPreviewUrl(data?.pdf_file || '');
        setDraftStatus(isViewMode ? 'Read only mode' : 'Loaded for editing');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load homework.');
      } finally {
        if (!cancelled) setIsLoadingItem(false);
      }
    };

    loadHomework();
    return () => {
      cancelled = true;
    };
  }, [canUseApi, homeworkId, isCreateMode, isViewMode]);

  useEffect(() => {
    if (!canUseApi || !isCreateMode) return;
    if (draftAvailable?.payload) return;
    const interval = setInterval(() => {
      try {
        const payload = { ...formRef.current, saved_at: new Date().toISOString() };
        payload.pdf_file_name = pdfFileNameRef.current;
        localStorage.setItem(draftKey, JSON.stringify(payload));
        setDraftStatus(`Draft saved | ${payload.saved_at.slice(11, 16)}`);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [canUseApi, draftAvailable?.payload, draftKey, isCreateMode]);

  const restoreDraft = () => {
    if (!draftAvailable?.payload) return;
    const payload = draftAvailable.payload;
    applyDraft(payload);
    setDraftAvailable(null);
    setFlash('Draft restored.');

    if (draftAvailable?.willMigrateTo) {
      try {
        localStorage.setItem(draftAvailable.willMigrateTo, JSON.stringify(payload));
        localStorage.removeItem(draftAvailable.key);
      } catch {}
    }
  };

  const discardDraft = () => {
    if (!draftAvailable?.key) return;
    try {
      localStorage.removeItem(draftAvailable.key);
      if (draftAvailable?.willMigrateTo) localStorage.removeItem(draftAvailable.willMigrateTo);
    } catch {}
    setDraftAvailable(null);
    setDraftStatus('Draft not saved yet');
    setFlash('Draft discarded.');
  };

  const submit = async e => {
    e.preventDefault();
    e.stopPropagation();
    if (isViewMode) return;
    setError('');
    setFlash('');

    try {
      const [classId, section] = String(form.classroom || '').split(':', 2);
      const endpoint = isEditMode ? `/homeworks/${encodeURIComponent(homeworkId)}/` : '/homeworks/';
      const method = isEditMode ? 'PATCH' : 'POST';

      if (form.content_mode === 'PDF' && (isCreateMode || pdfFile)) {
        if (isCreateMode && !pdfFile) throw new Error('Please select a PDF file.');
        const formData = new FormData();
        formData.append('title', form.title);
        formData.append('short_description', form.short_description || '');
        formData.append('homework_type', homeworkType);
        formData.append('class_name', String(Number(classId)));
        formData.append('section', section || '');
        formData.append('subject', String(Number(form.subject)));
        if (form.class_date) formData.append('class_date', form.class_date);
        formData.append('description', '');
        formData.append('due_date', form.due_date);
        formData.append('allow_late_submission', form.allow_late_submission ? 'true' : 'false');
        formData.append('status', form.status);
        if (pdfFile) formData.append('pdf_file', pdfFile);
        await apiForm(endpoint, { method, formData });
      } else {
        const payload = {
          title: form.title,
          short_description: form.short_description || '',
          homework_type: homeworkType,
          class_name: Number(classId),
          section: section || '',
          subject: Number(form.subject),
          ...(form.class_date ? { class_date: form.class_date } : {}),
          description: form.content_mode === 'TEXT' ? form.description : '',
          due_date: form.due_date,
          allow_late_submission: Boolean(form.allow_late_submission),
          status: form.status,
        };
        await apiJson(endpoint, { method, body: payload });
      }

      if (isEditMode) {
        setFlash(`${noun} updated.`);
        setDraftStatus(form.status === 'PUBLISHED' ? `${noun} is active.` : `${noun} is in draft.`);
        return;
      }

      setFlash(`${noun} created.`);
      setForm(emptyForm);
      setPdfFile(null);
      setPdfFileName('');
      if (pdfPreviewUrl && pdfPreviewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(pdfPreviewUrl);
        } catch {}
      }
      setPdfPreviewUrl('');
      setSubjects([]);
      try {
        localStorage.removeItem(draftKey);
        localStorage.removeItem(baseDraftKey);
      } catch {}
      setDraftAvailable(null);
      setDraftStatus('Draft not saved yet');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : `Failed to save ${noun.toLowerCase()}.`);
    }
  };

  if (!canUseApi) return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;

  return (
    <>
      <PageMeta title={pageHeading} />
      <main>
        <PageBreadcrumb title={pageHeading} subtitle="Educational" />

        <div className="card">
          <div className="card-body pb-24">
            {flash ? <div className="mb-3 text-sm text-primary">{flash}</div> : null}
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            {isLoadingItem ? <div className="mb-3 text-sm text-default-600">Loading {noun.toLowerCase()}...</div> : null}
            {isCreateMode && draftAvailable?.payload ? (
              <div className="mb-3 rounded-md border border-default-200 bg-default-50 p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-default-700">
                  <div className="font-medium">Draft available</div>
                  <div className="text-xs text-default-500">
                    {draftScope.label}
                    {draftAvailable?.payload?.saved_at ? ` | Saved at ${String(draftAvailable.payload.saved_at).slice(11, 16)}` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-sm bg-default-100 text-default-800" onClick={restoreDraft}>
                    Restore draft
                  </button>
                  <button type="button" className="btn btn-sm bg-danger text-white" onClick={discardDraft}>
                    Discard
                  </button>
                </div>
              </div>
            ) : null}

            {isViewMode ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {detailItems.map(item => (
                    <div key={item.label} className="rounded-md border border-default-200 p-4">
                      <div className="text-xs text-default-500">{item.label}</div>
                      <div className="mt-1 text-sm font-medium text-default-900 whitespace-pre-wrap">{item.value}</div>
                    </div>
                  ))}
                </div>

                {form.content_mode === 'TEXT' ? (
                  <div className="rounded-md border border-default-200 p-4">
                    <div className="text-xs text-default-500">Description</div>
                    <div
                      className="mt-3 prose prose-sm max-w-none text-default-900"
                      dangerouslySetInnerHTML={{ __html: form.description || '<p>No description.</p>' }}
                    />
                  </div>
                ) : null}

                {pdfPreviewUrl ? (
                  <div className="rounded-md border border-default-200 p-4">
                    <div className="text-xs text-default-500">PDF Preview</div>
                    <iframe title="PDF preview" src={pdfPreviewUrl} className="mt-3 w-full h-[720px] rounded-md border border-default-200" />
                  </div>
                ) : null}
              </div>
            ) : (
            <form id="homework-create-form" onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm text-default-700">Title</label>
                <input
                  className="form-input w-full"
                  value={form.title}
                  onChange={e => setForm(current => ({ ...current, title: e.target.value }))}
                  disabled={isLocked}
                  required
                />
                <div className="mt-3">
                  <label className="text-sm text-default-700">Short Description</label>
                  <textarea
                    className="form-textarea w-full"
                    value={form.short_description}
                    onChange={e => setForm(current => ({ ...current, short_description: e.target.value }))}
                    disabled={isLocked}
                    rows={2}
                    placeholder="Write a short summary..."
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-default-700">Classroom</label>
                <select
                  className="form-select w-full"
                  value={form.classroom}
                  onChange={e => setForm(current => ({ ...current, classroom: e.target.value, subject: '' }))}
                  disabled={isLocked || (keepSelectionLocked && Boolean(String(form.classroom || '').trim()))}
                  required
                >
                  <option value="">Select class</option>
                  {classes.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-default-700">Subject</label>
                <select
                  className="form-select w-full"
                  value={form.subject}
                  onChange={e => setForm(current => ({ ...current, subject: e.target.value }))}
                  disabled={isLocked || (keepSelectionLocked && Boolean(String(form.subject || '').trim()))}
                  required
                >
                  <option value="">Select subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-default-500">
                  {form.content_mode === 'PDF'
                    ? 'PDF upload is enabled for description.'
                    : 'Rich text editor is enabled for description.'}
                </div>
              </div>

              <div>
                <label className="text-sm text-default-700">Class Date (for listing)</label>
                <input
                  type="date"
                  className="form-input w-full"
                  value={form.class_date}
                  onChange={e => setForm(current => ({ ...current, class_date: e.target.value }))}
                  disabled={isLocked || (keepSelectionLocked && Boolean(String(form.class_date || '').trim()))}
                />
                <div className="mt-1 text-xs text-default-500">Optional: keeps homework grouped under the selected class date even if due date is later.</div>
              </div>

              <div>
                <label className="text-sm text-default-700">Due Date</label>
                <input
                  type="datetime-local"
                  className="form-input w-full"
                  value={form.due_date}
                  onChange={e => setForm(current => ({ ...current, due_date: e.target.value }))}
                  disabled={isLocked}
                  required
                />
              </div>

              <div className="flex items-end gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-default-700">
                  <input
                    type="checkbox"
                    checked={form.allow_late_submission}
                    onChange={e => setForm(current => ({ ...current, allow_late_submission: e.target.checked }))}
                    disabled={isLocked}
                  />
                  Allow late submission
                </label>
              </div>

              <div>
                <label className="text-sm text-default-700">Status</label>
                <select
                  className="form-select w-full"
                  value={form.status}
                  onChange={e => setForm(current => ({ ...current, status: e.target.value }))}
                  disabled={isLocked}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published / Active</option>
                </select>
                <div className="mt-1 text-xs text-default-500">
                  You can choose active/published while creating the homework.
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-default-700">Description</label>
                <div className={isFullscreen ? 'fixed inset-0 z-[9999] p-4 bg-white overflow-auto' : ''}>
                  <div className="mb-2 flex justify-end">
                    <button type="button" className="btn btn-sm bg-default-100 text-default-800" onClick={() => setIsFullscreen(v => !v)}>
                      {isFullscreen ? 'Exit full screen' : 'Full screen'}
                    </button>
                  </div>

                  <div className="flex gap-3 mb-4">
                    <button
                      type="button"
                      className="w-28 h-24 rounded-md border flex flex-col items-center justify-center gap-1 border-transparent"
                      style={form.content_mode === 'TEXT' ? { background: 'rgb(111, 66, 193)', color: 'rgb(255, 255, 255)' } : {}}
                      disabled={isLocked}
                      onClick={() => {
                        if (isLocked) return;
                        setForm(current => ({ ...current, content_mode: 'TEXT' }));
                        setPdfFile(null);
                        setPdfFileName('');
                        if (pdfPreviewUrl && pdfPreviewUrl.startsWith('blob:')) {
                          try {
                            URL.revokeObjectURL(pdfPreviewUrl);
                          } catch {}
                        }
                        setPdfPreviewUrl('');
                      }}
                    >
                      <div className="text-3xl font-extrabold leading-none">T</div>
                      <div className="text-sm font-medium">Text</div>
                    </button>
                    <button
                      type="button"
                      className="w-28 h-24 rounded-md border flex flex-col items-center justify-center gap-1 border-default-200"
                      style={form.content_mode === 'PDF' ? { background: 'rgb(111, 66, 193)', color: 'rgb(255, 255, 255)', borderColor: 'transparent' } : {}}
                      disabled={isLocked}
                      onClick={() => {
                        if (isLocked) return;
                        setForm(current => ({ ...current, content_mode: 'PDF' }));
                      }}
                    >
                      <div className="text-3xl font-extrabold leading-none">^</div>
                      <div className="text-sm font-medium">Upload</div>
                    </button>
                  </div>

                  {form.content_mode === 'PDF' ? (
                    <div className="rounded-md border border-default-200 p-4">
                      <label className="text-sm text-default-700">PDF File</label>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="form-input w-full mt-2"
                        disabled={isLocked}
                        onChange={e => {
                          const next = e.target.files?.[0] || null;
                          setPdfFile(next);
                          setPdfFileName(next?.name || '');
                          if (pdfPreviewUrl && pdfPreviewUrl.startsWith('blob:')) {
                            try {
                              URL.revokeObjectURL(pdfPreviewUrl);
                            } catch {}
                          }
                          setPdfPreviewUrl(next ? URL.createObjectURL(next) : '');
                          setDraftStatus('Unsaved changes - PDF selected');
                        }}
                      />

                      {pdfFileName ? (
                        <div className="mt-2 text-xs text-default-500">
                          Selected file: <span className="font-medium">{pdfFileName}</span>
                          {!pdfFile && !isCreateMode ? ' (keeping current file unless you replace it)' : ''}
                        </div>
                      ) : null}

                      {pdfPreviewUrl ? (
                        <div className="mt-4">
                          <div className="text-xs text-default-500 mb-2">Preview</div>
                          <iframe title="PDF preview" src={pdfPreviewUrl} className="w-full h-[520px] rounded-md border border-default-200" />
                        </div>
                      ) : null}

                      <div className="mt-2 text-xs text-default-500">{draftStatus}</div>
                    </div>
                  ) : (
                    <>
                      <DocumentEditor
                        value={form.description}
                        disabled={isLocked}
                        onChange={data => {
                          if (isLocked) return;
                          setForm(current => ({ ...current, description: data }));
                          setDraftStatus(`Unsaved changes | ${computeWordCount(data)} words`);
                        }}
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-default-500">
                        <div>Word count: {computeWordCount(form.description)}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </form>
            )}

            <div className="sticky bottom-0 z-20 border-t border-default-200 bg-white">
              <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
                <div className="text-sm text-default-600 flex items-center gap-2">
                  <div>{isViewMode ? `${noun} details` : draftStatus}</div>
                </div>
                <div className="flex items-center gap-2">
                  {isViewMode ? (
                    <>
                      <Link to={listRoute} className="btn bg-default-100 text-default-800">
                        Back
                      </Link>
                      <Link
                        to={`${createRoute}?id=${encodeURIComponent(homeworkId)}&mode=edit`}
                        className="btn text-white"
                        style={{ background: 'rgb(111, 66, 193)' }}
                      >
                        Edit {noun}
                      </Link>
                    </>
                  ) : (
                    <button
                      type="submit"
                      form="homework-create-form"
                      className="btn text-white"
                      disabled={!canSubmit}
                      style={{ background: 'rgb(111, 66, 193)' }}
                    >
                      {submitLabel}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default HomeworkCreate;
