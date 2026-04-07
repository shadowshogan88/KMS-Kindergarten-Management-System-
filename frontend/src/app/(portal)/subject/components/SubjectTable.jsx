import { useEffect, useMemo, useState } from 'react';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { Link, useSearchParams } from 'react-router';

import AddSubject from './AddSubject';
import DeleteModal from './DeleteModal';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { openOverlay } from '@/utils/overlay';
import Pagination from '@/components/Pagination';

const SubjectTable = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialClass = searchParams.get('class') || '';
  const initialSection = searchParams.get('section') || '';

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [flash, setFlash] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  const [classes, setClasses] = useState([]);
  const [schoolClass, setSchoolClass] = useState(initialClass);
  const [section, setSection] = useState(initialSection);
  const [isLoadingSchoolClasses, setIsLoadingSchoolClasses] = useState(false);
  const [classError, setClassError] = useState('');

  const load = async nextPage => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    if (!schoolClass) {
      setItems([]);
      setCount(0);
      setPage(1);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(nextPage));
      if (schoolClass) qs.set('class', String(schoolClass));
      if (section) qs.set('section', String(section));
      const data = await apiJson(`/subjects/?${qs.toString()}`);
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(results);
      setCount(typeof data?.count === 'number' ? data.count : results.length);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subjects.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;

    let isMounted = true;
    setClassError('');
    setIsLoadingSchoolClasses(true);
    apiJson('/academic-classes/simple/')
      .then(data => {
        if (!isMounted) return;
        setClasses(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        if (!isMounted) return;
        setClassError(e instanceof Error ? e.message : 'Failed to load classes.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingSchoolClasses(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedClass = useMemo(
    () => classes.find(c => String(c?.id) === String(schoolClass)) || null,
    [classes, schoolClass],
  );
  const sectionOptions = useMemo(
    () => (Array.isArray(selectedClass?.sections) ? selectedClass.sections : []),
    [selectedClass?.sections],
  );

  useEffect(() => {
    if (!selectedClass) return;
    const hasSections = sectionOptions.length > 0;
    if (!hasSections) {
      if (section) setSection('');
      return;
    }
    if (section && sectionOptions.includes(section.toUpperCase())) return;
    setSection(sectionOptions[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass?.id, sectionOptions.join(',')]);

  useEffect(() => {
    if (!schoolClass && section) setSection('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolClass]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (schoolClass) next.set('class', schoolClass);
    else next.delete('class');
    if (section) next.set('section', section);
    else next.delete('section');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolClass, section]);

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolClass, section]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const openAddModal = () => {
    setEditing(null);
    requestAnimationFrame(() => openOverlay('#subject-edit-modal'));
  };
  const openEditModal = row => {
    setEditing(row);
    requestAnimationFrame(() => openOverlay('#subject-edit-modal'));
  };
  const openDeleteModal = row => {
    setSelected(row);
    requestAnimationFrame(() => openOverlay('#subject-delete-modal'));
  };

  const onCreate = async payload => {
    const created = await apiJson('/subjects/', { method: 'POST', body: payload });
    setItems(prev => [created, ...prev].slice(0, 10));
    setCount(prev => prev + 1);
    setFlash('Subject added successfully.');
  };
  const onUpdate = async (row, payload) => {
    const updated = await apiJson(`/subjects/${row.id}/`, { method: 'PATCH', body: payload });
    setItems(prev => prev.map(d => (d.id === row.id ? updated : d)));
    setFlash('Subject updated successfully.');
  };
  const onDelete = async () => {
    if (!selected?.id) return;
    await apiJson(`/subjects/${selected.id}/`, { method: 'DELETE' });
    setItems(prev => prev.filter(d => d.id !== selected.id));
    setSelected(null);
    setCount(prev => Math.max(0, prev - 1));
    setFlash('Subject deleted successfully.');
  };

  const prettyType = t => (t === 'PRACTICAL' ? 'Practical' : 'Theory');

  const defaultClassroomKey = useMemo(() => {
    if (!schoolClass) return '';
    return `${schoolClass}:${section || ''}`;
  }, [schoolClass, section]);

  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <h6 className="card-title">Subjects</h6>
        <button
          className="btn btn-sm bg-primary text-white flex items-center gap-1"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            openAddModal();
          }}
          type="button"
        >
          <LuPlus className="size-4" /> Add Subject
        </button>
      </div>

      <div className="flex flex-col">
        <div className="px-5 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="subject-filter-class" className="inline-block mb-2 text-sm font-medium text-default-700">
                Class
              </label>
              <select
                id="subject-filter-class"
                className="form-input"
                value={schoolClass}
                onChange={e => setSchoolClass(e.target.value)}
                disabled={isLoadingSchoolClasses}
              >
                <option value="">{isLoadingSchoolClasses ? 'Loading classes...' : 'All classes'}</option>
                {classes.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
              {classError ? <div className="mt-2 text-xs text-danger">{classError}</div> : null}
            </div>

            <div>
              <label htmlFor="subject-filter-section" className="inline-block mb-2 text-sm font-medium text-default-700">
                Section
              </label>
              <select
                id="subject-filter-section"
                className="form-input"
                value={section}
                onChange={e => setSection(e.target.value)}
                disabled={!schoolClass || sectionOptions.length === 0}
              >
                <option value="">{!schoolClass ? 'Select class first' : sectionOptions.length ? 'Select section' : 'No sections'}</option>
                {sectionOptions.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedClass ? (
          <div className="px-5 pt-4 text-sm text-default-600">
            Showing subjects for <span className="font-semibold text-default-800">{selectedClass.name}</span>
            {section ? <span className="text-default-500"> ({section})</span> : null}
          </div>
        ) : null}

        {flash ? (
          <div className="px-5 pt-4">
            <div className="relative rounded-md border border-primary/20 bg-primary/10 px-4 py-3 pr-11 text-sm text-default-800">
              {flash}
              <button
                type="button"
                onClick={() => setFlash('')}
                className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-default-700 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Close message"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  ×
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {!authStorage.getAccess() ? (
          <div className="px-5 py-4 text-sm text-default-600">
            Please sign in from <Link className="text-primary underline" to="/portal">Portal</Link> to load subjects from
            backend.
          </div>
        ) : null}

        {error ? <div className="px-5 py-4 text-sm text-danger">{error}</div> : null}

        {!schoolClass ? (
          <div className="px-5 py-4 text-sm text-default-500">Select a class to view subjects.</div>
        ) : (
          <div className="mx-5 my-4 rounded-lg border border-default-200 bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-full inline-block align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-default-200">
                    <thead className="font-semibold whitespace-nowrap bg-default-50">
                      <tr className="text-sm text-default-800 divide-x divide-default-200">
                        <th className="px-3.5 py-3 text-start">#</th>
                        <th className="px-3.5 py-3 text-start">Code</th>
                        <th className="px-3.5 py-3 text-start">Subject Name</th>
                        <th className="px-3.5 py-3 text-start">Class</th>
                        <th className="px-3.5 py-3 text-start">Teacher</th>
                        <th className="px-3.5 py-3 text-start">Type</th>
                        <th className="px-3.5 py-3 text-start">Action</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-default-200">
                      {isLoading ? (
                        <tr className="text-default-800 font-normal whitespace-nowrap">
                          <td className="px-3.5 py-4 text-sm" colSpan={7}>
                            Loading...
                          </td>
                        </tr>
                      ) : null}

                      {!isLoading && items.length === 0 ? (
                        <tr className="text-default-800 font-normal whitespace-nowrap">
                          <td className="px-3.5 py-4 text-sm" colSpan={7}>
                            No subjects found.
                          </td>
                        </tr>
                      ) : null}

                      {items.map(row => (
                        <tr key={row.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                          <td className="px-3.5 py-3 text-sm">{row.id}</td>
                          <td className="px-3.5 py-3 text-sm">{row.code}</td>
                          <td className="px-3.5 py-3 text-sm">{row.name}</td>
                          <td className="px-3.5 py-3 text-sm">{row.classroom_label || '-'}</td>
                          <td className="px-3.5 py-3 text-sm">{row.subject_teacher_label || '-'}</td>
                          <td className="px-3.5 py-3 text-sm">{prettyType(row.subject_type)}</td>
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openEditModal(row);
                                }}
                                className="btn size-8 bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                                aria-haspopup="dialog"
                                aria-expanded="false"
                                aria-controls="subject-edit-modal"
                              >
                                <LuPencil className="size-4" />
                              </button>

                              <button
                                type="button"
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openDeleteModal(row);
                                }}
                                className="btn size-8 bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                                aria-haspopup="dialog"
                                aria-expanded="false"
                                aria-controls="subject-delete-modal"
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

            <div className="flex justify-between items-center px-5 py-4 border-t border-default-200">
              <p className="text-default-500 text-sm">
                Showing <b>{items.length}</b> of <b>{count}</b> Results
              </p>
              <Pagination page={page} totalPages={Math.ceil(count / 8)} onPageChange={p => load(p)} />
            </div>
          </div>
        )}
      </div>

      <DeleteModal subject={selected} onConfirm={async () => {
        await onDelete();
        if (items.length === 1 && page > 1) await load(page - 1);
        else await load(page);
      }} />
      <AddSubject subject={editing} onCreated={async p => {
        await onCreate(p);
        await load(1);
      }} onUpdated={async (d, p) => {
        await onUpdate(d, p);
        await load(page);
      }} onRefresh={() => load(page)} defaultClassroomKey={defaultClassroomKey} />
    </div>
  );
};

export default SubjectTable;
