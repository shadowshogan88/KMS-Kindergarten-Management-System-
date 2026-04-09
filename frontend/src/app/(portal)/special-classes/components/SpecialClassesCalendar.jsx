import { useEffect, useMemo, useState } from 'react';
import { LuExternalLink, LuPlus, LuRefreshCcw, LuTrash2, LuUpload } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { canPortal } from '@/utils/portalPermissions';
import { openOverlay, closeOverlay } from '@/utils/overlay';

const closeModal = () => closeOverlay('#special-class-edit-modal');

const pad2 = n => String(n).padStart(2, '0');

const formatYmd = d => {
  if (!(d instanceof Date)) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const ymdToDate = ymd => {
  const s = String(ymd || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getMonthLabel = monthDate =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(monthDate);

const mondayIndex = jsDay0Sun => (jsDay0Sun + 6) % 7;

const buildMonthGrid = monthDate => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = mondayIndex(first.getDay());
  const cells = [];
  for (let i = 0; i < blanks; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
};

const defaultForm = () => ({
  date: '',
  school_class: '',
  section: '',
  start_time: '09:00',
  end_time: '10:00',
  title: '',
  description: '',
  meet_link: '',
  is_active: true,
});

const SpecialClassesCalendar = () => {
  const canView = useMemo(() => canPortal('/portal/special-classes', 'view'), []);
  const canCreate = useMemo(() => canPortal('/portal/special-classes', 'create'), []);
  const canEdit = useMemo(() => canPortal('/portal/special-classes', 'edit'), []);
  const canDelete = useMemo(() => canPortal('/portal/special-classes', 'delete'), []);

  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => formatYmd(new Date()));

  const [classes, setClasses] = useState([]);
  const [items, setItems] = useState([]);
  const [monthDaysWithItems, setMonthDaysWithItems] = useState(() => new Set());

  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedDateObj = useMemo(() => ymdToDate(selectedDate), [selectedDate]);
  const monthLabel = useMemo(() => getMonthLabel(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)), [monthDate]);
  const grid = useMemo(() => buildMonthGrid(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)), [monthDate]);

  const selectedClass = useMemo(() => classes.find(c => String(c?.id) === String(form.school_class)) || null, [classes, form.school_class]);
  const sectionOptions = useMemo(() => (Array.isArray(selectedClass?.sections) ? selectedClass.sections : []), [selectedClass]);

  const loadClasses = async () => {
    try {
      const data = await apiJson('/academic-classes/simple/');
      setClasses(Array.isArray(data) ? data : []);
    } catch {
      setClasses([]);
    }
  };

  const loadMonth = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    setIsLoadingMonth(true);
    setError('');
    try {
      const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      const qs = new URLSearchParams();
      qs.set('from', formatYmd(start));
      qs.set('to', formatYmd(end));
      const data = await apiJson(`/special-live-classes/?${qs.toString()}`);
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const s = new Set();
      for (const it of results) {
        const d = String(it?.date || '');
        if (d) s.add(d);
      }
      setMonthDaysWithItems(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar.');
      setMonthDaysWithItems(new Set());
    } finally {
      setIsLoadingMonth(false);
    }
  };

  const loadDay = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    if (!selectedDate) return;
    setIsLoadingDay(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('date', selectedDate);
      const data = await apiJson(`/special-live-classes/?${qs.toString()}`);
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load classes.');
      setItems([]);
    } finally {
      setIsLoadingDay(false);
    }
  };

  useEffect(() => {
    if (!authStorage.getAccess()) return;
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authStorage.getAccess()) return;
    loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthDate.getFullYear(), monthDate.getMonth()]);

  useEffect(() => {
    if (!authStorage.getAccess()) return;
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!selectedDateObj) return;
    const sameMonth = selectedDateObj.getFullYear() === monthDate.getFullYear() && selectedDateObj.getMonth() === monthDate.getMonth();
    if (sameMonth) return;
    setMonthDate(new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    if (!sectionOptions.length) return;
    if (!form.section) return;
    if (sectionOptions.includes(String(form.section).toUpperCase())) return;
    setForm(v => ({ ...v, section: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionOptions.join(',')]);

  const prevMonth = () => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const openCreate = () => {
    if (!canCreate) {
      setFlash('No permission to create.');
      return;
    }
    setEditing(null);
    setError('');
    setForm({
      ...defaultForm(),
      date: selectedDate,
      school_class: classes[0]?.id ? String(classes[0].id) : '',
      section: '',
    });
    requestAnimationFrame(() => openOverlay('#special-class-edit-modal'));
  };

  const openEdit = it => {
    if (!canEdit) {
      setFlash('No permission to edit.');
      return;
    }
    setEditing(it);
    setError('');
    setForm({
      date: String(it?.date || selectedDate),
      school_class: it?.school_class ? String(it.school_class) : '',
      section: String(it?.section || ''),
      start_time: String(it?.start_time || '09:00'),
      end_time: String(it?.end_time || '10:00'),
      title: String(it?.title || ''),
      description: String(it?.description || ''),
      meet_link: String(it?.meet_link || ''),
      is_active: Boolean(it?.is_active),
    });
    requestAnimationFrame(() => openOverlay('#special-class-edit-modal'));
  };

  const submit = async () => {
    setError('');
    const isEdit = Boolean(editing?.id);
    if (isEdit && !canEdit) return setError('No permission to edit.');
    if (!isEdit && !canCreate) return setError('No permission to create.');

    if (!form.date) return setError('Date is required.');
    if (!form.school_class) return setError('Class is required.');
    if (!form.title.trim()) return setError('Title is required.');
    if (!form.start_time) return setError('Start time is required.');
    if (!form.end_time) return setError('End time is required.');

    setIsSubmitting(true);
    try {
      const payload = {
        date: form.date,
        school_class: Number(form.school_class),
        section: String(form.section || '').toUpperCase(),
        start_time: form.start_time,
        end_time: form.end_time,
        title: form.title.trim(),
        description: String(form.description || ''),
        meet_link: String(form.meet_link || ''),
        is_active: Boolean(form.is_active),
      };

      if (isEdit) {
        const updated = await apiJson(`/special-live-classes/${editing.id}/`, { method: 'PATCH', body: payload });
        setItems(prev => prev.map(x => (x.id === updated.id ? updated : x)));
        setFlash('Special class updated.');
      } else {
        const created = await apiJson('/special-live-classes/', { method: 'POST', body: payload });
        setItems(prev => [...(Array.isArray(prev) ? prev : []), created].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))));
        setFlash('Special class created.');
      }

      setMonthDaysWithItems(prev => {
        const next = new Set(Array.from(prev));
        next.add(form.date);
        return next;
      });

      closeModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async it => {
    if (!it?.id) return;
    if (!canDelete) return setFlash('No permission to delete.');
    if (!confirm('Delete this special class?')) return;
    try {
      await apiJson(`/special-live-classes/${it.id}/`, { method: 'DELETE' });
      setItems(prev => prev.filter(x => x.id !== it.id));
      setFlash('Deleted.');
      await loadMonth();
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'Failed to delete.');
    }
  };

  if (!canView) {
    return <div className="p-5 text-sm text-danger">You do not have permission to view special classes.</div>;
  }

  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <h6 className="card-title">Calendar</h6>
        <div className="text-sm text-default-600">Date-wise classes</div>
      </div>

      <div className="p-5">
        {flash ? (
          <div className="mb-4 rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-default-800">{flash}</div>
        ) : null}
        {error ? <div className="mb-4 text-sm text-danger">{error}</div> : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-default-200 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-default-200 flex items-center justify-between gap-2">
                <div className="font-semibold text-default-800">{monthLabel}</div>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={prevMonth}>
                    Prev
                  </button>
                  <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={nextMonth}>
                    Next
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-7 gap-2 text-xs text-default-500 mb-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <div key={d} className="text-center">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {grid.map((d, idx) => {
                    if (!d) return <div key={`e-${idx}`} className="h-9" />;

                    const ymd = formatYmd(d);
                    const isSelected = ymd === selectedDate;
                    const hasItems = monthDaysWithItems.has(ymd);

                    const cls = isSelected
                      ? 'h-9 rounded-md border text-sm flex items-center justify-center relative border-primary bg-primary/10 text-primary'
                      : hasItems
                        ? 'h-9 rounded-md border text-sm flex items-center justify-center relative border-warning bg-warning/10 text-warning hover:bg-warning/15'
                        : 'h-9 rounded-md border text-sm flex items-center justify-center relative border-default-200 hover:bg-default-150';

                    return (
                      <button key={ymd} type="button" className={cls} onClick={() => setSelectedDate(ymd)} disabled={isLoadingMonth}>
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>

                {isLoadingMonth ? <div className="mt-3 text-xs text-default-500">Loading month…</div> : null}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-lg border border-default-200 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-default-200 flex items-center justify-between gap-2">
                <div className="font-semibold text-default-800">Classes on {selectedDate || '—'}</div>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={loadDay} disabled={isLoadingDay}>
                    <LuRefreshCcw className="inline size-4" /> Refresh
                  </button>
                  <button type="button" className="btn btn-sm bg-primary text-white" onClick={openCreate} disabled={!canCreate}>
                    <LuPlus className="inline size-4" /> Add
                  </button>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-3">
                {isLoadingDay ? <div className="text-sm text-default-500">Loading…</div> : null}
                {!isLoadingDay && !items.length ? (
                  <div className="text-sm text-default-500">No special classes for this date.</div>
                ) : null}

                {items.map(it => (
                  <div key={it.id} className="rounded-md border border-default-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-default-800">{it.title}</div>
                        <div className="mt-1 text-sm text-default-500">
                          {it.start_time} - {it.end_time} · {it.school_class_name}
                          {it.section ? ` (${it.section})` : ''}
                          {it.is_active ? '' : ' · Inactive'}
                        </div>
                        {it.description ? <div className="mt-2 text-sm text-default-700">{String(it.description).slice(0, 140)}</div> : null}
                      </div>

                      <div className="flex items-center gap-2">
                        {it.meet_link ? (
                          <a
                            className="btn size-9 bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                            title="Open Meet"
                            href={it.meet_link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <LuExternalLink className="size-4" />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="btn size-9 bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                          title="Edit"
                          onClick={() => openEdit(it)}
                          disabled={!canEdit}
                        >
                          <LuUpload className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="btn size-9 bg-default-200 hover:bg-danger/10 hover:text-danger text-default-600"
                          title="Delete"
                          onClick={() => remove(it)}
                          disabled={!canDelete}
                        >
                          <LuTrash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        id="special-class-edit-modal"
        className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none hs-overlay-open:pointer-events-auto"
        role="dialog"
        tabIndex={-1}
        aria-labelledby="special-class-edit-modal-label"
      >
        <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-2xl sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
          <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
            <div className="card-header">
              <h3 id="special-class-edit-modal-label" className="font-bold text-default-800 text-base">
                {editing?.id ? 'Edit Special Class' : 'Add Special Class'}
              </h3>
              <div>
                <button type="button" className="size-5 text-default-800" aria-label="Close" onClick={closeModal} disabled={isSubmitting}>
                  <span className="sr-only">Close</span>
                  &times;
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto">
              {error ? <div className="mb-4 text-sm text-danger">{error}</div> : null}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="inline-block mb-2 text-base font-medium">Date</label>
                  <input className="form-input" type="date" value={form.date} onChange={e => setForm(v => ({ ...v, date: e.target.value }))} disabled={isSubmitting} />
                </div>

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
                  {sectionOptions.length ? (
                    <select className="form-input" value={form.section} onChange={e => setForm(v => ({ ...v, section: e.target.value }))} disabled={isSubmitting}>
                      <option value="">All sections</option>
                      {sectionOptions.map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input className="form-input" value={form.section} onChange={e => setForm(v => ({ ...v, section: e.target.value }))} disabled={isSubmitting} />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="inline-block mb-2 text-base font-medium">Start</label>
                    <input className="form-input" type="time" value={form.start_time} onChange={e => setForm(v => ({ ...v, start_time: e.target.value }))} disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="inline-block mb-2 text-base font-medium">End</label>
                    <input className="form-input" type="time" value={form.end_time} onChange={e => setForm(v => ({ ...v, end_time: e.target.value }))} disabled={isSubmitting} />
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <label className="inline-block mb-2 text-base font-medium">Title</label>
                  <input className="form-input" value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} disabled={isSubmitting} />
                </div>

                <div className="lg:col-span-2">
                  <label className="inline-block mb-2 text-base font-medium">Short Description (optional)</label>
                  <textarea className="form-input" rows={2} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} disabled={isSubmitting} />
                </div>

                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-block mb-2 text-base font-medium">Google Meet link (optional)</label>
                    <a className="btn btn-xs bg-default-200 hover:bg-default-300 text-default-700" href="https://meet.google.com/new" target="_blank" rel="noreferrer">
                      Create Meet
                    </a>
                  </div>
                  <input className="form-input" value={form.meet_link} onChange={e => setForm(v => ({ ...v, meet_link: e.target.value }))} disabled={isSubmitting} />
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer select-none lg:col-span-2">
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
                {isSubmitting ? 'Saving...' : editing?.id ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecialClassesCalendar;

