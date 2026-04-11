import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import DocumentEditor from '@/components/DocumentEditor';
import { apiForm, apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const computeWordCount = html => {
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  const text = (div.textContent || '').trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

const HomeworkCreate = ({ homeworkType = 'HOMEWORK', pageTitle = 'Create Homework' } = {}) => {
  const canUseApi = Boolean(authStorage.getAccess());
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const autosaveRef = useRef(null);
  const [draftStatus, setDraftStatus] = useState('Draft not saved yet');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mode = 'simple';
  const [form, setForm] = useState({
    title: '',
    short_description: '',
    classroom: '',
    subject: '',
    due_date: '',
    allow_late_submission: false,
    content_mode: 'TEXT',
    description: '',
    status: 'DRAFT',
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');

  useEffect(() => {
    return () => {
      if (!pdfPreviewUrl) return;
      try {
        URL.revokeObjectURL(pdfPreviewUrl);
      } catch {}
    };
  }, [pdfPreviewUrl]);

  const draftKey = useMemo(() => `kms.homework.create.${homeworkType}.draft`, [homeworkType]);
  const submitLabel = useMemo(() => (homeworkType === 'ASSIGNMENT' ? 'Submit Assignment' : 'Create'), [homeworkType]);
  const canSubmit = useMemo(() => {
    if (!String(form.title || '').trim()) return false;
    if (!String(form.classroom || '').trim()) return false;
    if (!String(form.subject || '').trim()) return false;
    if (!String(form.due_date || '').trim()) return false;
    if (form.content_mode === 'PDF' && !pdfFile) return false;
    return true;
  }, [form.classroom, form.content_mode, form.due_date, form.subject, form.title, pdfFile]);

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
  }, []);

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
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setForm(f => ({
          ...f,
          title: typeof parsed.title === 'string' ? parsed.title : f.title,
          short_description: typeof parsed.short_description === 'string' ? parsed.short_description : f.short_description,
          classroom: typeof parsed.classroom === 'string' ? parsed.classroom : f.classroom,
          subject: typeof parsed.subject === 'string' ? parsed.subject : f.subject,
          due_date: typeof parsed.due_date === 'string' ? parsed.due_date : f.due_date,
          allow_late_submission: Boolean(parsed.allow_late_submission),
          content_mode: parsed.content_mode === 'PDF' ? 'PDF' : 'TEXT',
          description: typeof parsed.description === 'string' ? parsed.description : f.description,
        }));
        if (typeof parsed?.pdf_file_name === 'string') setPdfFileName(parsed.pdf_file_name);
        if (parsed?.saved_at) setDraftStatus(`Draft saved • ${String(parsed.saved_at).slice(11, 16)}`);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!autosaveRef.current) {
      autosaveRef.current = setInterval(() => {
        try {
          const payload = { ...form, saved_at: new Date().toISOString() };
          payload.pdf_file_name = pdfFileName;
          localStorage.setItem(draftKey, JSON.stringify(payload));
          setDraftStatus(`Draft saved • ${payload.saved_at.slice(11, 16)}`);
        } catch {}
      }, 10000);
    }
    return () => {
      if (autosaveRef.current) {
        clearInterval(autosaveRef.current);
        autosaveRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, form, pdfFileName]);

  const submit = async e => {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    setFlash('');
    try {
      const [classId, section] = String(form.classroom || '').split(':', 2);

      if (form.content_mode === 'PDF') {
        if (!pdfFile) throw new Error('Please select a PDF file.');
        const formData = new FormData();
        formData.append('title', form.title);
        formData.append('short_description', form.short_description || '');
        formData.append('homework_type', homeworkType);
        formData.append('class_name', String(Number(classId)));
        formData.append('section', section || '');
        formData.append('subject', String(Number(form.subject)));
        formData.append('description', '');
        formData.append('due_date', form.due_date);
        formData.append('allow_late_submission', form.allow_late_submission ? 'true' : 'false');
        formData.append('status', form.status);
        formData.append('pdf_file', pdfFile);
        await apiForm('/homeworks/', { method: 'POST', formData });
      } else {
        const payload = {
          title: form.title,
          short_description: form.short_description || '',
          homework_type: homeworkType,
          class_name: Number(classId),
          section: section || '',
          subject: Number(form.subject),
          description: form.description,
          due_date: form.due_date,
          allow_late_submission: Boolean(form.allow_late_submission),
          status: form.status,
        };
        await apiJson('/homeworks/', { method: 'POST', body: payload });
      }

      setFlash(homeworkType === 'ASSIGNMENT' ? 'Assignment created.' : 'Homework created.');
      setForm({
        title: '',
        short_description: '',
        classroom: '',
        subject: '',
        due_date: '',
        allow_late_submission: false,
        content_mode: 'TEXT',
        description: '',
        status: 'DRAFT',
      });
      setPdfFile(null);
      setPdfFileName('');
      if (pdfPreviewUrl) {
        try {
          URL.revokeObjectURL(pdfPreviewUrl);
        } catch {}
      }
      setPdfPreviewUrl('');
      setSubjects([]);
      try {
        localStorage.removeItem(draftKey);
        setDraftStatus('Draft not saved yet');
      } catch {}
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to create item.');
    }
  };

  if (!canUseApi) return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;

  return (
    <>
      <PageMeta title={pageTitle} />
      <main>
        <PageBreadcrumb title={pageTitle} subtitle="Educational" />

        {mode === 'simple' ? (
        <div className="card">
          <div className="card-body pb-24">
            {flash ? <div className="mb-3 text-sm text-primary">{flash}</div> : null}
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}

            <form id="homework-create-form" onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm text-default-700">Title</label>
                <input className="form-input w-full" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                <div className="mt-3">
                  <label className="text-sm text-default-700">Short Description</label>
                  <textarea
                    className="form-textarea w-full"
                    value={form.short_description}
                    onChange={e => setForm(f => ({ ...f, short_description: e.target.value }))}
                    rows={2}
                    placeholder="Write a short summary..."
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-default-700">Classroom</label>
                <select className="form-select w-full" value={form.classroom} onChange={e => setForm(f => ({ ...f, classroom: e.target.value, subject: '' }))} required>
                  <option value="">Select class</option>
                  {classes.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-default-700">Subject</label>
                <select className="form-select w-full" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required>
                  <option value="">Select subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-default-500">
                  {form.content_mode === 'PDF'
                    ? 'PDF upload is enabled for description (draft auto-saves every 10 seconds; file must be reselected after reload).'
                    : 'Rich text editor is enabled for description (auto-saves draft every 10 seconds).'}
                </div>
              </div>
              <div>
                <label className="text-sm text-default-700">Due Date</label>
                <input type="datetime-local" className="form-input w-full" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} required />
              </div>
              <div className="flex items-end gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-default-700">
                  <input type="checkbox" checked={form.allow_late_submission} onChange={e => setForm(f => ({ ...f, allow_late_submission: e.target.checked }))} />
                  Allow late submission
                </label>
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
                      style={
                        form.content_mode === 'TEXT'
                          ? { background: 'rgb(111, 66, 193)', color: 'rgb(255, 255, 255)' }
                          : {}
                      }
                      onClick={() => {
                        setForm(f => ({ ...f, content_mode: 'TEXT' }));
                        setPdfFile(null);
                        setPdfFileName('');
                        if (pdfPreviewUrl) {
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
                      style={
                        form.content_mode === 'PDF'
                          ? { background: 'rgb(111, 66, 193)', color: 'rgb(255, 255, 255)', borderColor: 'transparent' }
                          : {}
                      }
                      onClick={() => setForm(f => ({ ...f, content_mode: 'PDF' }))}
                    >
                      <div className="text-3xl font-extrabold leading-none">↑</div>
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
                        onChange={e => {
                          const next = e.target.files?.[0] || null;
                          setPdfFile(next);
                          setPdfFileName(next?.name || '');
                          if (pdfPreviewUrl) {
                            try {
                              URL.revokeObjectURL(pdfPreviewUrl);
                            } catch {}
                          }
                          setPdfPreviewUrl(next ? URL.createObjectURL(next) : '');
                          setDraftStatus('Unsaved changes - PDF selected');
                        }}
                      />

                      {pdfFileName && !pdfFile ? (
                        <div className="mt-2 text-xs text-default-500">
                          Last selected: <span className="font-medium">{pdfFileName}</span> (please reselect before submit)
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
                        onChange={data => {
                          setForm(f => ({ ...f, description: data }));
                          setDraftStatus(`Unsaved changes • ${computeWordCount(data)} words`);
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

            <div className="sticky bottom-0 z-20 border-t border-default-200 bg-white">
              <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
                <div className="text-sm text-default-600 flex items-center gap-2">
                  <div>{draftStatus}</div>
                </div>
                <button
                  type="submit"
                  form="homework-create-form"
                  className="btn text-white"
                  disabled={!canSubmit}
                  style={{ background: 'rgb(111, 66, 193)' }}
                >
                  {submitLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
        ) : null}
      </main>
    </>
  );
};

export default HomeworkCreate;
