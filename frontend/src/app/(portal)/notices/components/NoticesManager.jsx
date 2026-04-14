import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LuEye, LuPin, LuPinOff, LuPlus, LuRefreshCcw, LuSearch, LuTrash2, LuUpload } from 'react-icons/lu';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Bold,
  Italic,
  Underline,
  Link as LinkPlugin,
  List,
  Heading,
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';

import { apiForm, apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { canPortal } from '@/utils/portalPermissions';
import { openOverlay, closeOverlay } from '@/utils/overlay';

const closeModal = () => closeOverlay('#notice-edit-modal');

const sortNotices = list => {
  const arr = Array.isArray(list) ? list.slice() : [];
  return arr.sort((a, b) => {
    const ap = Boolean(a?.is_pinned);
    const bp = Boolean(b?.is_pinned);
    if (ap !== bp) return ap ? -1 : 1;
    return String(b?.pinned_at || b?.created_at || '').localeCompare(String(a?.pinned_at || a?.created_at || ''));
  });
};

const NoticesManager = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const canView = useMemo(() => canPortal('/portal/notices', 'view'), []);
  const canCreate = useMemo(() => canPortal('/portal/notices', 'create'), []);
  const canEdit = useMemo(() => canPortal('/portal/notices', 'edit'), []);
  const canDelete = useMemo(() => canPortal('/portal/notices', 'delete'), []);

  const [q, setQ] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('');
  const [schoolClassFilter, setSchoolClassFilter] = useState('');

  const [classes, setClasses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    content_html: '',
    audience: 'ALL_SCHOOL',
    school_classes: [],
    pdf_file: null,
    is_active: true,
    is_pinned: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadClasses = async () => {
    try {
      const data = await apiJson('/academic-classes/simple/');
      setClasses(Array.isArray(data) ? data : []);
    } catch {
      setClasses([]);
    }
  };

  const load = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('page', '1');
      if (q.trim()) qs.set('q', q.trim());
      if (audienceFilter) qs.set('audience', audienceFilter);
      if (schoolClassFilter) qs.set('class', schoolClassFilter);
      const data = await apiJson(`/notices/?${qs.toString()}`);
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(sortNotices(results));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notices.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const openCreate = () => {
    setEditing(null);
    setError('');
    setForm({
      title: '',
      description: '',
      content_html: '',
      audience: audienceFilter || 'ALL_SCHOOL',
      school_classes: schoolClassFilter ? [String(schoolClassFilter)] : [],
      pdf_file: null,
      is_active: true,
      is_pinned: false,
    });
    requestAnimationFrame(() => openOverlay('#notice-edit-modal'));
  };

  const openEdit = it => {
    setEditing(it);
    setError('');
    setForm({
      title: it?.title || '',
      description: it?.description || '',
      content_html: it?.content_html || '',
      audience: it?.audience || 'ALL_SCHOOL',
      school_classes: Array.isArray(it?.school_classes) ? it.school_classes.map(String) : [],
      pdf_file: null,
      is_active: Boolean(it?.is_active),
      is_pinned: Boolean(it?.is_pinned),
    });
    requestAnimationFrame(() => openOverlay('#notice-edit-modal'));
  };

  const submit = async () => {
    setError('');
    const isEdit = Boolean(editing?.id);
    if (isEdit && !canEdit) return setError('You do not have permission to edit notices.');
    if (!isEdit && !canCreate) return setError('You do not have permission to create notices.');
    if (!form.title.trim()) return setError('Title is required.');

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.set('title', form.title.trim());
      fd.set('description', String(form.description || ''));
      fd.set('content_html', form.content_html || '');
      fd.set('audience', form.audience);
      fd.set('is_active', form.is_active ? 'true' : 'false');
      if (Array.isArray(form.school_classes)) {
        for (const id of form.school_classes) fd.append('school_classes', String(id));
      }
      if (form.pdf_file) fd.set('pdf_file', form.pdf_file);

      if (isEdit) {
        const updated = await apiForm(`/notices/${editing.id}/`, { method: 'PATCH', formData: fd });
        setItems(prev => sortNotices(prev.map(n => (n.id === updated.id ? updated : n))));
        setFlash('Notice updated.');

        if (Boolean(form.is_pinned) !== Boolean(editing?.is_pinned)) {
          const pinned = await apiJson(`/notices/${editing.id}/pin/`, { method: 'POST', body: { is_pinned: Boolean(form.is_pinned) } });
          setItems(prev => sortNotices(prev.map(n => (n.id === pinned.id ? pinned : n))));
        }
      } else {
        const created = await apiForm('/notices/', { method: 'POST', formData: fd });
        setItems(prev => sortNotices([created, ...(Array.isArray(prev) ? prev : [])]));
        setFlash('Notice created.');

        if (form.is_pinned && created?.id) {
          const pinned = await apiJson(`/notices/${created.id}/pin/`, { method: 'POST', body: { is_pinned: true } });
          setItems(prev => sortNotices(prev.map(n => (n.id === pinned.id ? pinned : n))));
        }
      }

      closeModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save notice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePin = async notice => {
    if (!notice?.id) return;
    if (!canEdit) {
      setFlash('No permission to pin/unpin.');
      return;
    }
    try {
      const next = await apiJson(`/notices/${notice.id}/pin/`, { method: 'POST', body: { is_pinned: !notice.is_pinned } });
      setItems(prev => sortNotices(prev.map(n => (n.id === next.id ? next : n))));
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'Failed to update pin.');
    }
  };

  const remove = async notice => {
    if (!notice?.id) return;
    if (!canDelete) {
      setFlash('No permission to delete.');
      return;
    }
    if (!confirm('Delete this notice?')) return;
    try {
      await apiJson(`/notices/${notice.id}/`, { method: 'DELETE' });
      setItems(prev => (Array.isArray(prev) ? prev.filter(n => n.id !== notice.id) : []));
      setFlash('Notice deleted.');
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'Failed to delete notice.');
    }
  };

  if (!canView) {
    return <div className="p-5 text-sm text-danger">You do not have permission to view notices.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {flash ? (
        <div className="px-5">
          <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-default-800">{flash}</div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h6 className="card-title">Notices</h6>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={load} disabled={isLoading}>
              <LuRefreshCcw className="inline size-4" /> Refresh
            </button>
            <button type="button" className="btn btn-sm bg-primary text-white" onClick={openCreate} disabled={!canCreate}>
              <LuPlus className="inline size-4" /> Add Notice
            </button>
          </div>
        </div>
        <div className="p-5">
          {error ? <div className="mb-4 text-sm text-danger">{error}</div> : null}

          <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-default-900">Smart Filters</div>
              <div className="text-sm text-default-600">Filter notices by keyword, audience and class.</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-default-500">Live Count</div>
              <div className="mt-1 text-xl font-semibold text-default-900">{items.length}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label className="sr-only">Search</label>
              <div className="relative">
                <input className="ps-11 form-input" placeholder="Search notices..." value={q} onChange={e => setQ(e.target.value)} />
                <div className="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
                  <LuSearch className="size-4 text-default-500" />
                </div>
              </div>
            </div>
            <div>
              <label className="sr-only">Audience</label>
              <select className="form-input" value={audienceFilter} onChange={e => setAudienceFilter(e.target.value)}>
                <option value="">All audiences</option>
                <option value="ALL_SCHOOL">All School</option>
                <option value="TEACHERS">All Teachers</option>
                <option value="PARENTS">All Parents</option>
              </select>
            </div>
            <div>
              <label className="sr-only">Class</label>
              <select className="form-input" value={schoolClassFilter} onChange={e => setSchoolClassFilter(e.target.value)}>
                <option value="">All classes</option>
                {classes.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button type="button" className="btn bg-default-900 text-white px-5" onClick={load} disabled={isLoading}>
              Apply Filters
            </button>
          </div>
          </div>

          <div className="mt-5 portal-table-shell">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-default-200">
              <thead className="font-semibold whitespace-nowrap bg-default-50">
                <tr className="text-sm text-default-800">
                  <th className="px-3.5 py-3 font-medium text-start">Pinned</th>
                  <th className="px-3.5 py-3 font-medium text-start">Title</th>
                  <th className="px-3.5 py-3 font-medium text-start">Audience</th>
                  <th className="px-3.5 py-3 font-medium text-start">Classes</th>
                  <th className="px-3.5 py-3 font-medium text-start">Active</th>
                  <th className="px-3.5 py-3 font-medium text-start">PDF</th>
                  <th className="px-3.5 py-3 font-medium text-start">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default-200">
                {isLoading ? (
                  <tr className="text-default-800 font-normal whitespace-nowrap">
                    <td className="px-3.5 py-4 text-sm" colSpan={7}>
                      Loading...
                    </td>
                  </tr>
                ) : !items.length ? (
                  <tr className="text-default-800 font-normal whitespace-nowrap">
                    <td className="px-3.5 py-4 text-sm" colSpan={7}>
                      No notices found.
                    </td>
                  </tr>
                ) : null}

                {items.map(n => {
                  const shortDesc = String(n?.description || '').trim();
                  return (
                  <tr key={n.id} className="text-default-800 font-normal whitespace-nowrap">
                    <td className="px-3.5 py-3 text-sm">
                      <button
                        type="button"
                        className="btn size-8 bg-default-200 hover:bg-warning/10 hover:text-warning text-default-600"
                        title={n.is_pinned ? 'Unpin' : 'Pin'}
                        onClick={() => togglePin(n)}
                        disabled={!canEdit}
                      >
                        {n.is_pinned ? <LuPinOff className="size-4" /> : <LuPin className="size-4" />}
                      </button>
                    </td>
                    <td className="px-3.5 py-3 text-sm">
                      <div className="font-medium">{n.title}</div>
                      <div className="text-xs text-default-500">
                        {shortDesc ? shortDesc.slice(0, 60) : ''}
                        {shortDesc && n.created_by_username ? ' | ' : ''}
                        {n.created_by_username ? `By ${n.created_by_username}` : ''}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-sm">
                      {n.audience === 'TEACHERS' ? 'All Teachers' : n.audience === 'PARENTS' ? 'All Parents' : 'All School'}
                    </td>
                    <td className="px-3.5 py-3 text-sm">
                      {Array.isArray(n?.school_classes_detail) && n.school_classes_detail.length
                        ? n.school_classes_detail.map(x => x?.name).filter(Boolean).join(', ')
                        : 'All classes'}
                    </td>
                    <td className="px-3.5 py-3 text-sm">{n.is_active ? 'Yes' : 'No'}</td>
                    <td className="px-3.5 py-3 text-sm">
                      {n.pdf_file ? (
                        <Link
                          className="btn size-8 bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                          title="View"
                          to={`/portal/notices/${n.id}`}
                        >
                          <LuEye className="size-4" />
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn size-8 bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                          title="Edit"
                          onClick={() => openEdit(n)}
                          disabled={!canEdit}
                        >
                          <LuUpload className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="btn size-8 bg-default-200 hover:bg-danger/10 hover:text-danger text-default-600"
                          title="Delete"
                          onClick={() => remove(n)}
                          disabled={!canDelete}
                        >
                          <LuTrash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>

      <div
        id="notice-edit-modal"
        className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none hs-overlay-open:pointer-events-auto"
        role="dialog"
        tabIndex={-1}
        aria-labelledby="notice-edit-modal-label"
      >
        <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-2xl sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
          <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
            <div className="card-header">
              <h3 id="notice-edit-modal-label" className="font-bold text-default-800 text-base">
                {editing?.id ? 'Edit Notice' : 'Add Notice'}
              </h3>
              <div>
                <button type="button" className="size-5 text-default-800" aria-label="Close" onClick={closeModal} disabled={isSubmitting}>
                  <span className="sr-only">Close</span>
                  &times;
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto">
              {error ? (
                <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
              ) : null}

              <div className="flex flex-col gap-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="inline-block mb-2 text-base font-medium">Audience</label>
                    <select
                      className="form-input"
                      value={form.audience}
                      onChange={e => setForm(v => ({ ...v, audience: e.target.value }))}
                      disabled={isSubmitting}
                    >
                      <option value="ALL_SCHOOL">All School</option>
                      <option value="TEACHERS">All Teachers</option>
                      <option value="PARENTS">All Parents</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="inline-block mb-2 text-base font-medium">Classes (optional)</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-xs bg-default-200 hover:bg-default-300 text-default-700"
                          onClick={() => setForm(v => ({ ...v, school_classes: classes.map(c => String(c.id)) }))}
                          disabled={isSubmitting || classes.length === 0}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs bg-default-200 hover:bg-default-300 text-default-700"
                          onClick={() => setForm(v => ({ ...v, school_classes: [] }))}
                          disabled={isSubmitting}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <select
                      className="form-input h-auto min-h-[180px] py-2"
                      multiple
                      size={6}
                      value={form.school_classes}
                      onChange={e => {
                        const selected = Array.from(e.target.selectedOptions).map(o => String(o.value));
                        setForm(v => ({ ...v, school_classes: selected }));
                      }}
                      disabled={isSubmitting}
                    >
                      {classes.map(c => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-xs text-default-500">Keep empty to send to all classes.</div>
                  </div>
                </div>

                <div>
                  <label className="inline-block mb-2 text-base font-medium">Title</label>
                  <input className="form-input" value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} disabled={isSubmitting} />
                </div>

                <div>
                  <label className="inline-block mb-2 text-base font-medium">Short Description (optional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={form.description}
                    onChange={e => setForm(v => ({ ...v, description: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      className="form-checkbox rounded"
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))}
                      disabled={isSubmitting}
                    />
                    <span className="text-sm text-default-700">Active</span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      className="form-checkbox rounded"
                      type="checkbox"
                      checked={form.is_pinned}
                      onChange={e => setForm(v => ({ ...v, is_pinned: e.target.checked }))}
                      disabled={isSubmitting || (!editing?.id && !canCreate) || (editing?.id && !canEdit)}
                    />
                    <span className="text-sm text-default-700">Pin this notice</span>
                  </label>
                </div>

                <div>
                  <label className="inline-block mb-2 text-base font-medium">Content</label>
                  <div className="rounded-md border border-default-200">
                    <CKEditor
                      editor={ClassicEditor}
                      data={form.content_html}
                      disabled={isSubmitting}
                      config={{
                        plugins: [Essentials, Paragraph, Bold, Italic, Underline, LinkPlugin, List, Heading],
                        toolbar: ['heading', '|', 'bold', 'italic', 'underline', '|', 'bulletedList', 'numberedList', '|', 'link', '|', 'undo', 'redo'],
                      }}
                      onChange={(_, editor) => {
                        const data = editor.getData();
                        setForm(v => ({ ...v, content_html: data }));
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="inline-block mb-2 text-base font-medium">{editing?.id ? 'Replace PDF (optional)' : 'PDF (optional)'}</label>
                  <input
                    className="form-input"
                    type="file"
                    accept="application/pdf"
                    onChange={e => setForm(v => ({ ...v, pdf_file: e.target.files?.[0] || null }))}
                    disabled={isSubmitting}
                  />
                  <div className="mt-1 text-xs text-default-500">Upload a PDF attachment for this notice.</div>
                </div>
              </div>
            </div>

            <div className="card-footer flex justify-end gap-2">
              <button type="button" className="btn bg-default-100 text-default-800" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="button"
                className="btn bg-primary text-white"
                onClick={submit}
                disabled={isSubmitting || (editing?.id ? !canEdit : !canCreate)}
              >
                {isSubmitting ? 'Saving...' : editing?.id ? 'Update Notice' : 'Add Notice'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoticesManager;

