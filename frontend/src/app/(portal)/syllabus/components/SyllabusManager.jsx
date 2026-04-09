import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LuEye, LuPlus, LuRefreshCcw, LuSearch, LuTrash2, LuUpload } from 'react-icons/lu';

import { apiForm, apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { canPortal } from '@/utils/portalPermissions';
import { openOverlay, closeOverlay } from '@/utils/overlay';

const closeModal = () => closeOverlay('#syllabus-edit-modal');

const SyllabusManager = () => {
  const canView = useMemo(() => canPortal('/portal/syllabus', 'view'), []);
  const canCreate = useMemo(() => canPortal('/portal/syllabus', 'create'), []);
  const canEdit = useMemo(() => canPortal('/portal/syllabus', 'edit'), []);
  const canDelete = useMemo(() => canPortal('/portal/syllabus', 'delete'), []);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [subjects, setSubjects] = useState([]);

  const [classes, setClasses] = useState([]);
  const [schoolClass, setSchoolClass] = useState('');
  const [section, setSection] = useState('');
  const selectedClass = useMemo(() => classes.find(c => String(c?.id) === String(schoolClass)) || null, [classes, schoolClass]);
  const sectionOptions = useMemo(() => (Array.isArray(selectedClass?.sections) ? selectedClass.sections : []), [selectedClass?.sections]);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    school_class: '',
    section: '',
    subject: '',
    pdf_file: null,
    is_active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSubjects = async () => {
    try {
      const data = await apiJson('/subjects/options/');
      setSubjects(Array.isArray(data) ? data : []);
    } catch {
      setSubjects([]);
    }
  };

  const loadClasses = async () => {
    try {
      const data = await apiJson('/academic-classes/simple/');
      setClasses(Array.isArray(data) ? data : []);
    } catch {
      setClasses([]);
    }
  };

  useEffect(() => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    loadSubjects();
    loadClasses();
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    if (!sectionOptions.length) {
      if (section) setSection('');
      return;
    }
    if (section && sectionOptions.includes(section.toUpperCase())) return;
    setSection(sectionOptions[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass?.id, sectionOptions.join(',')]);

  const load = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('page', '1');
      if (q.trim()) qs.set('q', q.trim());
      if (subject) qs.set('subject', subject);
      if (schoolClass) qs.set('class', schoolClass);
      if (section) qs.set('section', section);
      const data = await apiJson(`/syllabus/?${qs.toString()}`);
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load syllabus.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      description: '',
      school_class: schoolClass || '',
      section: section || '',
      subject: subject || '',
      pdf_file: null,
      is_active: true,
    });
    requestAnimationFrame(() => openOverlay('#syllabus-edit-modal'));
  };

  const openEdit = it => {
    setEditing(it);
    setForm({
      title: it?.title || '',
      description: it?.description || '',
      school_class: it?.school_class ? String(it.school_class) : '',
      section: it?.section || '',
      subject: it?.subject ? String(it.subject) : '',
      pdf_file: null,
      is_active: Boolean(it?.is_active),
    });
    requestAnimationFrame(() => openOverlay('#syllabus-edit-modal'));
  };

  const submit = async () => {
    setError('');
    const isEdit = Boolean(editing?.id);
    if (isEdit && !canEdit) return setError('No permission to edit syllabus.');
    if (!isEdit && !canCreate) return setError('No permission to create syllabus.');

    if (!form.school_class) return setError('Class is required.');
    if (!form.subject) return setError('Subject is required.');
    if (!form.title.trim()) return setError('Title is required.');
    if (!isEdit && !form.pdf_file) return setError('PDF file is required.');

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.set('school_class', String(form.school_class));
      fd.set('section', String(form.section || ''));
      fd.set('subject', String(form.subject));
      fd.set('title', form.title.trim());
      fd.set('description', String(form.description || ''));
      fd.set('is_active', form.is_active ? 'true' : 'false');
      if (form.pdf_file) fd.set('pdf_file', form.pdf_file);

      if (isEdit) {
        const updated = await apiForm(`/syllabus/${editing.id}/`, { method: 'PATCH', formData: fd });
        setItems(prev => prev.map(x => (x.id === updated.id ? updated : x)));
        setFlash('Syllabus updated.');
      } else {
        const created = await apiForm('/syllabus/', { method: 'POST', formData: fd });
        setItems(prev => [created, ...(Array.isArray(prev) ? prev : [])]);
        setFlash('Syllabus created.');
      }
      closeModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save syllabus.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async it => {
    if (!it?.id) return;
    if (!canDelete) return setFlash('No permission to delete.');
    if (!confirm('Delete this syllabus?')) return;
    try {
      await apiJson(`/syllabus/${it.id}/`, { method: 'DELETE' });
      setItems(prev => prev.filter(x => x.id !== it.id));
      setFlash('Syllabus deleted.');
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'Failed to delete.');
    }
  };

  if (!canView) {
    return <div className="p-5 text-sm text-danger">You do not have permission to view syllabus.</div>;
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
          <h6 className="card-title">Syllabus</h6>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={load} disabled={isLoading}>
              <LuRefreshCcw className="inline size-4" /> Refresh
            </button>
            <button type="button" className="btn btn-sm bg-primary text-white" onClick={openCreate} disabled={!canCreate}>
              <LuPlus className="inline size-4" /> Add Syllabus
            </button>
          </div>
        </div>

        <div className="p-5">
          {error ? <div className="mb-4 text-sm text-danger">{error}</div> : null}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label className="sr-only">Search</label>
              <div className="relative">
                <input className="ps-11 form-input" placeholder="Search syllabus..." value={q} onChange={e => setQ(e.target.value)} />
                <div className="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
                  <LuSearch className="size-4 text-default-500" />
                </div>
              </div>
            </div>
            <div>
              <label className="sr-only">Class</label>
              <select className="form-input" value={schoolClass} onChange={e => setSchoolClass(e.target.value)}>
                <option value="">All classes</option>
                {classes.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="sr-only">Section</label>
              <select className="form-input" value={section} onChange={e => setSection(e.target.value)} disabled={!schoolClass || sectionOptions.length === 0}>
                <option value="">{sectionOptions.length ? 'All sections' : 'No sections'}</option>
                {sectionOptions.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="sr-only">Subject</label>
              <select className="form-input" value={subject} onChange={e => setSubject(e.target.value)}>
                <option value="">All subjects</option>
                {subjects.map(s => (
                  <option key={s.value} value={String(s.value)}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2 flex justify-end">
              <button type="button" className="btn bg-default-200 hover:bg-default-300 text-default-700" onClick={load} disabled={isLoading}>
                <LuSearch className="inline size-4" /> Search
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-default-200">
              <thead className="bg-default-100 font-normal whitespace-nowrap">
                <tr className="text-sm text-default-800">
                  <th className="px-3.5 py-3 font-medium text-start">Title</th>
                  <th className="px-3.5 py-3 font-medium text-start">Class</th>
                  <th className="px-3.5 py-3 font-medium text-start">Subject</th>
                  <th className="px-3.5 py-3 font-medium text-start">Active</th>
                  <th className="px-3.5 py-3 font-medium text-start">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default-200">
                {isLoading ? (
                  <tr className="text-default-800 font-normal whitespace-nowrap">
                    <td className="px-3.5 py-4 text-sm" colSpan={5}>
                      Loading...
                    </td>
                  </tr>
                ) : !items.length ? (
                  <tr className="text-default-800 font-normal whitespace-nowrap">
                    <td className="px-3.5 py-4 text-sm" colSpan={5}>
                      No syllabus found.
                    </td>
                  </tr>
                ) : null}

                {items.map(it => (
                  <tr key={it.id} className="text-default-800 font-normal whitespace-nowrap">
                    <td className="px-3.5 py-3 text-sm">
                      <div className="font-medium">{it.title}</div>
                      <div className="text-xs text-default-500">{it.description ? String(it.description).slice(0, 60) : ''}</div>
                    </td>
                    <td className="px-3.5 py-3 text-sm">
                      {it.school_class_name || '-'}
                      {it.section ? <span className="text-default-500"> ({it.section})</span> : null}
                    </td>
                    <td className="px-3.5 py-3 text-sm">{it.subject_code ? `${it.subject_code} - ${it.subject_name}` : it.subject_name || '-'}</td>
                    <td className="px-3.5 py-3 text-sm">{it.is_active ? 'Yes' : 'No'}</td>
                    <td className="px-3.5 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/portal/syllabus/${it.id}`}
                          className="btn size-8 bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                          title="View"
                        >
                          <LuEye className="size-4" />
                        </Link>
                        <button
                          type="button"
                          className="btn size-8 bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                          title="Edit"
                          onClick={() => openEdit(it)}
                          disabled={!canEdit}
                        >
                          <LuUpload className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="btn size-8 bg-default-200 hover:bg-danger/10 hover:text-danger text-default-600"
                          title="Delete"
                          onClick={() => remove(it)}
                          disabled={!canDelete}
                        >
                          <LuTrash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div
        id="syllabus-edit-modal"
        className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none hs-overlay-open:pointer-events-auto"
        role="dialog"
        tabIndex={-1}
        aria-labelledby="syllabus-edit-modal-label"
      >
        <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-xl sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
          <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
            <div className="card-header">
              <h3 id="syllabus-edit-modal-label" className="font-bold text-default-800 text-base">
                {editing?.id ? 'Edit Syllabus' : 'Add Syllabus'}
              </h3>
              <div>
                <button type="button" className="size-5 text-default-800" aria-label="Close" onClick={closeModal} disabled={isSubmitting}>
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto">
              {error ? (
                <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
              ) : null}

              <div className="flex flex-col gap-y-4">
                <div>
                  <label className="inline-block mb-2 text-base font-medium">Class</label>
                  <select className="form-input" value={form.school_class} onChange={e => setForm(v => ({ ...v, school_class: e.target.value }))} disabled={isSubmitting}>
                    <option value="">Select class</option>
                    {classes.map(c => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="inline-block mb-2 text-base font-medium">Section (optional)</label>
                  <input className="form-input" value={form.section} onChange={e => setForm(v => ({ ...v, section: e.target.value }))} disabled={isSubmitting} />
                </div>

                <div>
                  <label className="inline-block mb-2 text-base font-medium">Subject</label>
                  <select className="form-input" value={form.subject} onChange={e => setForm(v => ({ ...v, subject: e.target.value }))} disabled={isSubmitting}>
                    <option value="">Select subject</option>
                    {subjects.map(s => (
                      <option key={s.value} value={String(s.value)}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="inline-block mb-2 text-base font-medium">Title</label>
                  <input className="form-input" value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} disabled={isSubmitting} />
                </div>

                <div>
                  <label className="inline-block mb-2 text-base font-medium">Description (optional)</label>
                  <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} disabled={isSubmitting} />
                </div>

                <div>
                  <label className="inline-block mb-2 text-base font-medium">{editing?.id ? 'Replace PDF (optional)' : 'PDF file'}</label>
                  <input
                    className="form-input"
                    type="file"
                    accept="application/pdf"
                    onChange={e => setForm(v => ({ ...v, pdf_file: e.target.files?.[0] || null }))}
                    disabled={isSubmitting}
                  />
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input className="form-checkbox rounded" type="checkbox" checked={form.is_active} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))} disabled={isSubmitting} />
                  <span className="text-sm text-default-700">Active</span>
                </label>
              </div>
            </div>

            <div className="card-footer flex justify-end gap-2">
              <button type="button" className="btn bg-default-100 text-default-800" onClick={closeModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" className="btn bg-primary text-white" onClick={submit} disabled={isSubmitting || (editing?.id ? !canEdit : !canCreate)}>
                {isSubmitting ? 'Saving...' : editing?.id ? 'Update Syllabus' : 'Add Syllabus'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyllabusManager;
