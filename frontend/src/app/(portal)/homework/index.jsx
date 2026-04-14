import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router';
import { LuSearch } from 'react-icons/lu';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const formatDate = value => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString();
};

const formatDateTime = value => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 19).replace('T', ' ');
  return parsed.toLocaleString();
};

const getStatusBadgeClass = status => {
  switch (String(status || '').toUpperCase()) {
    case 'PUBLISHED':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'DRAFT':
      return 'bg-amber-100 text-amber-700 ring-amber-200';
    case 'ARCHIVED':
      return 'bg-slate-200 text-slate-700 ring-slate-300';
    default:
      return 'bg-sky-100 text-sky-700 ring-sky-200';
  }
};

const HomeworkList = () => {
  const canUseApi = Boolean(authStorage.getAccess());
  const user = authStorage.getUser();
  const role = user?.role || '';
  const canCreate = role === 'ADMIN' || role === 'TEACHER';
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [classOptions, setClassOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const canPublish = role === 'ADMIN' || role === 'TEACHER';
  const canDelete = role === 'ADMIN' || role === 'TEACHER';
  const scopedClassId = user?.student_school_class_id != null ? String(user.student_school_class_id) : '';
  const scopedSection = (user?.student_section || '').toString().trim().toUpperCase();
  const hasLockedClassSection = Boolean(scopedClassId);
  const [filters, setFilters] = useState(() => ({
    q: searchParams.get('q') || '',
    classId: scopedClassId || searchParams.get('class') || '',
    section: scopedSection || searchParams.get('section') || '',
    subjectId: searchParams.get('subject') || '',
    date: searchParams.get('date') || '',
  }));

  const selectedClass = useMemo(
    () => classOptions.find(option => String(option?.id) === String(filters.classId)) || null,
    [classOptions, filters.classId]
  );
  const sectionOptions = useMemo(
    () => (Array.isArray(selectedClass?.sections) ? selectedClass.sections : []),
    [selectedClass]
  );

  useEffect(() => {
    setFilters({
      q: searchParams.get('q') || '',
      classId: scopedClassId || searchParams.get('class') || '',
      section: scopedSection || searchParams.get('section') || '',
      subjectId: searchParams.get('subject') || '',
      date: searchParams.get('date') || '',
    });
  }, [scopedClassId, scopedSection, searchParams]);

  useEffect(() => {
    if (!hasLockedClassSection) return;
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if ((next.get('class') || '') !== scopedClassId) {
      next.set('class', scopedClassId);
      changed = true;
    }
    if ((next.get('section') || '').toUpperCase() !== scopedSection) {
      if (scopedSection) next.set('section', scopedSection);
      else next.delete('section');
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [hasLockedClassSection, scopedClassId, scopedSection, searchParams, setSearchParams]);

  useEffect(() => {
    if (!canUseApi) return;
    let mounted = true;

    apiJson('/academic-classes/simple/')
      .then(data => {
        if (!mounted) return;
        setClassOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!mounted) return;
        setClassOptions([]);
      });

    return () => {
      mounted = false;
    };
  }, [canUseApi]);

  useEffect(() => {
    if (!canUseApi) return;
    let mounted = true;
    const qs = new URLSearchParams();
    if (filters.classId) qs.set('class_name', filters.classId);
    if (filters.section) qs.set('section', filters.section);

    apiJson(`/subjects/options/${qs.toString() ? `?${qs.toString()}` : ''}`)
      .then(data => {
        if (!mounted) return;
        setSubjectOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!mounted) return;
        setSubjectOptions([]);
      });

    return () => {
      mounted = false;
    };
  }, [canUseApi, filters.classId, filters.section]);

  const load = async () => {
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('type', 'HOMEWORK');

      const q = (searchParams.get('q') || '').trim();
      const classId = (searchParams.get('class') || '').trim();
      const section = (searchParams.get('section') || '').trim();
      const subjectId = (searchParams.get('subject') || '').trim();
      const date = (searchParams.get('date') || '').trim();

      if (q) qs.set('q', q);
      if (classId) qs.set('class', classId);
      if (section) qs.set('section', section);
      if (subjectId) qs.set('subject', subjectId);
      if (date) qs.set('date', date);

      const data = await apiJson(`/homeworks/?${qs.toString()}`);
      const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load homework.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const publishHomework = async homeworkId => {
    setBusyId(homeworkId);
    setError('');
    try {
      await apiJson(`/homeworks/${homeworkId}/publish/`, { method: 'POST' });
      setItems(prev => prev.map(item => (item.id === homeworkId ? { ...item, status: 'PUBLISHED' } : item)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish homework.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteHomework = async homeworkId => {
    const ok = window.confirm('Delete this homework?');
    if (!ok) return;
    setBusyId(homeworkId);
    setError('');
    try {
      await apiJson(`/homeworks/${homeworkId}/`, { method: 'DELETE' });
      setItems(prev => prev.filter(item => item.id !== homeworkId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete homework.');
    } finally {
      setBusyId(null);
    }
  };

  const applyFilters = () => {
    const next = new URLSearchParams();
    if (filters.q.trim()) next.set('q', filters.q.trim());
    if (filters.classId) next.set('class', filters.classId);
    if (filters.section) next.set('section', filters.section);
    if (filters.subjectId) next.set('subject', filters.subjectId);
    if (filters.date) next.set('date', filters.date);
    setSearchParams(next);
  };

  const clearFilters = () => {
    setFilters({ q: '', classId: scopedClassId, section: scopedSection, subjectId: '', date: '' });
    const next = new URLSearchParams();
    if (scopedClassId) next.set('class', scopedClassId);
    if (scopedSection) next.set('section', scopedSection);
    setSearchParams(next);
  };

  if (!canUseApi) return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;

  return (
    <>
      <PageMeta title="Homework" />
      <main>
        <PageBreadcrumb title="Homework" subtitle="Educational" />
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h6 className="card-title">Homework List</h6>
            <div className="flex gap-2">
              {canCreate ? (
                <Link className="btn btn-sm bg-primary text-white" to="/portal/homework/create">
                  Create
                </Link>
              ) : null}
              <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); load(); }}>
                Refresh
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="flex flex-col">
              {error ? <div className="px-5 pt-4 text-sm text-danger">{error}</div> : null}

              <div className="mb-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-default-900">Smart Filters</div>
                    <div className="text-sm text-default-600">Filter homework by search, class, section, subject and date.</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-default-500">Live Count</div>
                    <div className="mt-1 text-xl font-semibold text-default-900">{items.length}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
                  <div className="lg:col-span-2">
                    <label className="sr-only">Search</label>
                    <div className="relative">
                      <input
                        className="ps-11 form-input"
                        placeholder="Search homework..."
                        value={filters.q}
                        onChange={e => setFilters(prev => ({ ...prev, q: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') applyFilters();
                        }}
                      />
                      <div className="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
                        <LuSearch className="size-4 text-default-500" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="sr-only">Class</label>
                    <select
                      className="form-input"
                      value={filters.classId}
                      onChange={e =>
                        setFilters(prev => ({
                          ...prev,
                          classId: e.target.value,
                          section: '',
                          subjectId: '',
                        }))
                      }
                      disabled={hasLockedClassSection}
                    >
                      <option value="">All classes</option>
                      {classOptions.map(option => (
                        <option key={option.id} value={String(option.id)}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="sr-only">Section</label>
                    <select
                      className="form-input"
                      value={filters.section}
                      onChange={e => setFilters(prev => ({ ...prev, section: e.target.value, subjectId: '' }))}
                      disabled={hasLockedClassSection || !filters.classId || sectionOptions.length === 0}
                    >
                      <option value="">{sectionOptions.length ? 'All sections' : 'No sections'}</option>
                      {sectionOptions.map(section => (
                        <option key={section} value={section}>
                          {section}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="sr-only">Subject</label>
                    <select
                      className="form-input"
                      value={filters.subjectId}
                      onChange={e => setFilters(prev => ({ ...prev, subjectId: e.target.value }))}
                    >
                      <option value="">All subjects</option>
                      {subjectOptions.map(option => (
                        <option key={option.value} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="sr-only">Class Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={filters.date}
                      onChange={e => setFilters(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="lg:col-span-6 flex justify-end gap-2">
                    <button type="button" className="btn bg-default-200 px-5" onClick={clearFilters}>
                      Clear
                    </button>
                    <button type="button" className="btn bg-default-900 text-white px-5" onClick={applyFilters}>
                      <LuSearch className="inline size-4" /> Search
                    </button>
                  </div>
                </div>
              </div>

              {isLoading ? <div className="px-5 py-4 text-sm">Loading...</div> : null}
              {!isLoading && items.length === 0 ? <div className="px-5 py-4 text-sm text-default-600">No homework found.</div> : null}

              {items.length ? (
                <>
                  <div className="px-5 pt-4 text-sm text-default-600">
                    Showing homework for <span className="font-semibold text-default-800">{selectedClass?.name || 'All Classes'}</span>
                    {filters.section ? <span className="text-default-500"> ({filters.section})</span> : null}
                  </div>

                  <div className="mx-5 my-4 rounded-lg border border-default-200 bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <div className="min-w-full inline-block align-middle">
                        <div className="overflow-hidden">
                          <table className="min-w-full divide-y divide-default-200">
                            <thead className="font-semibold whitespace-nowrap bg-default-50">
                              <tr className="text-sm text-default-800 divide-x divide-default-200">
                                <th className="px-3.5 py-3 text-start">ID</th>
                                <th className="px-3.5 py-3 text-start">Title</th>
                                <th className="px-3.5 py-3 text-start">Class</th>
                                <th className="px-3.5 py-3 text-start">Class Date</th>
                                <th className="px-3.5 py-3 text-start">Subject</th>
                                <th className="px-3.5 py-3 text-start">Due</th>
                                <th className="px-3.5 py-3 text-start">Status</th>
                                <th className="px-3.5 py-3 text-start">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-default-200">
                              {items.map(hw => (
                                <tr key={hw.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                                  <td className="px-3.5 py-3 text-sm">{hw.id}</td>
                                  <td className="px-3.5 py-3 text-sm">{hw.title}</td>
                                  <td className="px-3.5 py-3 text-sm">{hw.classroom_label || hw.class_label || '-'}</td>
                                  <td className="px-3.5 py-3 text-sm">{formatDate(hw.class_date)}</td>
                                  <td className="px-3.5 py-3 text-sm">{hw.subject_label || '-'}</td>
                                  <td className="px-3.5 py-3 text-sm">{formatDateTime(hw.due_date)}</td>
                                  <td className="px-3.5 py-3 text-sm">
                                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getStatusBadgeClass(hw.status)}`}>
                                      {hw.status}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-3 text-sm">
                                    <div className="flex flex-wrap gap-2">
                                      {role === 'STUDENT' ? (
                                        <>
                                          <Link className="text-primary underline" to={`/portal/homework/create?id=${encodeURIComponent(hw.id)}&mode=view`}>
                                            View
                                          </Link>
                                          <Link className="text-primary underline" to={`/portal/homework/${hw.id}/submit`}>
                                            Submit
                                          </Link>
                                        </>
                                      ) : (
                                        <>
                                          <Link className="text-primary underline" to={`/portal/homework/create?id=${encodeURIComponent(hw.id)}&mode=view`}>
                                            View
                                          </Link>
                                          <Link className="text-primary underline" to={`/portal/homework/create?id=${encodeURIComponent(hw.id)}&mode=edit`}>
                                            Edit
                                          </Link>
                                          <Link className="text-primary underline" to={`/portal/homework/submissions?homework=${encodeURIComponent(hw.id)}`}>
                                            Review
                                          </Link>
                                          {canPublish && hw.status !== 'PUBLISHED' ? (
                                            <button
                                              type="button"
                                              className="text-success underline disabled:text-default-400"
                                              disabled={busyId === hw.id}
                                              onClick={() => publishHomework(hw.id)}
                                            >
                                              {busyId === hw.id ? 'Publishing...' : 'Activate'}
                                            </button>
                                          ) : null}
                                          {canDelete ? (
                                            <button
                                              type="button"
                                              className="text-danger underline disabled:text-default-400"
                                              disabled={busyId === hw.id}
                                              onClick={() => deleteHomework(hw.id)}
                                            >
                                              {busyId === hw.id ? 'Working...' : 'Delete'}
                                            </button>
                                          ) : null}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default HomeworkList;
