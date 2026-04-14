import { useEffect, useMemo, useState } from 'react';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { Link } from 'react-router';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { openOverlay } from '@/utils/overlay';
import Pagination from '@/components/Pagination';

import AddStudent from './AddStudent';
import DeleteModal from './DeleteModal';

const StudentTable = ({ mode = 'list' }) => {
  const isRollMode = mode === 'roll';
  const role = authStorage.getUser()?.role || '';
  const isAdmin = role === 'ADMIN';
  const canManageRoll = role === 'ADMIN' || role === 'TEACHER';
  const PAGE_SIZE = 50;
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [flash, setFlash] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [classOptions, setClassOptions] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [filters, setFilters] = useState({ year: '', classId: '', section: '' });

  const selectedClass = useMemo(
    () => classOptions.find(option => String(option?.id) === String(filters.classId)) || null,
    [classOptions, filters.classId]
  );
  const sectionOptions = useMemo(
    () => (Array.isArray(selectedClass?.sections) ? selectedClass.sections : []),
    [selectedClass]
  );

  const load = async (nextPage, fallbackTried = false) => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(nextPage));
      if (isAdmin && filters.year) qs.set('year', filters.year);
      if (isAdmin && filters.classId) qs.set('class', filters.classId);
      if (isAdmin && filters.section) qs.set('section', filters.section);
      const data = await apiJson(`/students/?${qs.toString()}`);
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(results);
      setCount(typeof data?.count === 'number' ? data.count : results.length);
      setPage(nextPage);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load students.';
      if (!fallbackTried && /invalid page/i.test(message)) {
        await load(1, true);
        return;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (!isAdmin) return () => { mounted = false; };
    apiJson('/academic-classes/simple/')
      .then(data => {
        if (!mounted) return;
        setClassOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!mounted) return;
        setClassOptions([]);
      });
    apiJson('/students/filter-options/')
      .then(data => {
        if (!mounted) return;
        const years = Array.isArray(data?.years) ? data.years.map(y => String(y)) : [];
        setYearOptions(years);
      })
      .catch(() => {
        if (!mounted) return;
        setYearOptions([]);
      });
    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!filters.classId && filters.section) {
      setFilters(prev => ({ ...prev, section: '' }));
      return;
    }
    if (filters.section && sectionOptions.length && !sectionOptions.includes(filters.section)) {
      setFilters(prev => ({ ...prev, section: '' }));
    }
  }, [filters.classId, filters.section, sectionOptions]);

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filters.year, filters.classId, filters.section, isAdmin]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  const openAddModal = () => {
    setEditing(null);
    requestAnimationFrame(() => openOverlay('#student-edit-modal'));
  };
  const openEditModal = row => {
    setEditing(row);
    requestAnimationFrame(() => openOverlay('#student-edit-modal'));
  };
  const openDeleteModal = row => {
    setSelected(row);
    requestAnimationFrame(() => openOverlay('#student-delete-modal'));
  };

  const onCreate = async payload => {
    const created = await apiJson('/students/', { method: 'POST', body: payload });
    setFlash('Student added successfully.');
    return created;
  };

  const onUpdate = async (row, payload) => {
    const updated = await apiJson(`/students/${row.id}/`, { method: 'PATCH', body: payload });
    setFlash('Student updated successfully.');
    return updated;
  };

  const onDelete = async () => {
    if (!selected?.id) return;
    await apiJson(`/students/${selected.id}/`, { method: 'DELETE' });
    setSelected(null);
    setFlash('Student deleted successfully.');
  };

  const onChangeRoll = async row => {
    if (!row?.id) return;
    if (!canManageRoll) return;
    const raw = window.prompt('Enter new roll number', row?.roll_no ? String(row.roll_no) : '');
    if (raw === null) return;
    const value = String(raw).trim();
    if (!value) return;
    const rollNo = Number(value);
    if (!Number.isInteger(rollNo) || rollNo < 1) {
      setError('Roll number must be a positive integer.');
      return;
    }
    setError('');
    await apiJson(`/students/${row.id}/change-roll/`, { method: 'POST', body: { roll_no: rollNo } });
    setFlash(`Roll updated for ${`${row.first_name || ''} ${row.last_name || ''}`.trim() || 'student'}.`);
    await load(page);
  };

  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <div>
          <h6 className="card-title">{isRollMode ? 'Roll Management' : 'Students'}</h6>
          <div className="mt-1 text-xs text-default-500">
            {isRollMode ? 'Manage class-wise unique student roll numbers.' : 'Manage students and profile details.'}
          </div>
        </div>
        {!isRollMode ? (
          <button
            className="btn btn-sm bg-primary text-white flex items-center gap-1"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              openAddModal();
            }}
            type="button"
          >
            <LuPlus className="size-4" /> Add Student
          </button>
        ) : null}
      </div>

      <div className="flex flex-col">
        {isAdmin ? (
          <div className="px-5 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select
                className="form-input"
                value={filters.year}
                onChange={e => setFilters(prev => ({ ...prev, year: e.target.value }))}
              >
                <option value="">All Session Years</option>
                {yearOptions.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                className="form-input"
                value={filters.classId}
                onChange={e => setFilters(prev => ({ ...prev, classId: e.target.value, section: '' }))}
              >
                <option value="">All Classes</option>
                {classOptions.map(option => (
                  <option key={option.id} value={String(option.id)}>
                    {option.name}
                  </option>
                ))}
              </select>
              <select
                className="form-input"
                value={filters.section}
                onChange={e => setFilters(prev => ({ ...prev, section: e.target.value }))}
                disabled={!filters.classId || sectionOptions.length === 0}
              >
                <option value="">{sectionOptions.length ? 'All Sections' : 'No Sections'}</option>
                {sectionOptions.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn bg-default-200"
                onClick={() => setFilters({ year: '', classId: '', section: '' })}
              >
                Clear Filters
              </button>
            </div>
          </div>
        ) : null}

        <div className="px-5 pt-4">
          <div className="inline-flex rounded-lg border border-default-200 bg-default-100 p-1">
            <Link className={`px-3 py-1.5 text-sm rounded-md ${!isRollMode ? 'bg-white text-default-900 shadow-sm' : 'text-default-600'}`} to="/portal/students">
              Student List
            </Link>
            <Link className={`px-3 py-1.5 text-sm rounded-md ${isRollMode ? 'bg-white text-default-900 shadow-sm' : 'text-default-600'}`} to="/portal/students?tab=roll">
              Roll Management
            </Link>
          </div>
        </div>

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
                  Ãƒâ€”
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {!authStorage.getAccess() ? (
          <div className="px-5 py-4 text-sm text-default-600">
            Please sign in from <Link className="text-primary underline" to="/portal">Portal</Link> to load students from backend.
          </div>
        ) : null}

        {error ? <div className="px-5 py-4 text-sm text-danger">{error}</div> : null}

        <div className="overflow-x-auto">
          <div className="min-w-full inline-block align-middle">
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-default-200">
                <thead className="font-semibold whitespace-nowrap">
                  <tr className="text-sm text-default-800 divide-x divide-default-200">
                    <th className="px-3.5 py-3 text-start">#</th>
                    <th className="px-3.5 py-3 text-start">Student Name</th>
                    <th className="px-3.5 py-3 text-start">Roll</th>
                    <th className="px-3.5 py-3 text-start">Class</th>
                    <th className="px-3.5 py-3 text-start">Section</th>
                    {!isRollMode ? (
                      <>
                        <th className="px-3.5 py-3 text-start">Email</th>
                        <th className="px-3.5 py-3 text-start">Phone</th>
                        <th className="px-3.5 py-3 text-start">Username</th>
                      </>
                    ) : null}
                    <th className="px-3.5 py-3 text-start">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-default-200">
                  {isLoading ? (
                    <tr className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-4 text-sm" colSpan={isRollMode ? 6 : 9}>
                        Loading...
                      </td>
                    </tr>
                  ) : null}

                  {!isLoading && items.length === 0 ? (
                    <tr className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-4 text-sm" colSpan={isRollMode ? 6 : 9}>
                        No students found.
                      </td>
                    </tr>
                  ) : null}

                  {items.map(row => (
                    <tr key={row.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                      <td className="px-3.5 py-3 text-sm">{row.id}</td>
                      <td className="px-3.5 py-3 text-sm">{`${row.first_name || ''} ${row.last_name || ''}`.trim() || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">
                        <span className="inline-flex rounded-full bg-default-100 px-3 py-1 text-xs font-semibold text-default-800">
                          {row.roll_no || '-'}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-sm">{row.school_class_label || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">{row.section || '-'}</td>
                      {!isRollMode ? (
                        <>
                          <td className="px-3.5 py-3 text-sm">{row.user_email || row.email || '-'}</td>
                          <td className="px-3.5 py-3 text-sm">{row.phone || '-'}</td>
                          <td className="px-3.5 py-3 text-sm">{row.user_username || '-'}</td>
                        </>
                      ) : null}
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          {isRollMode ? (
                            <button
                              type="button"
                              onClick={async e => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  await onChangeRoll(row);
                                } catch (e2) {
                                  setError(e2 instanceof Error ? e2.message : 'Failed to change roll.');
                                }
                              }}
                              className="btn btn-sm bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200"
                              disabled={!canManageRoll}
                            >
                              Change Roll
                            </button>
                          ) : (
                            <>
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
                                aria-controls="student-edit-modal"
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
                                aria-controls="student-delete-modal"
                              >
                                <LuTrash2 className="size-4" />
                              </button>
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

        <div className="card-footer flex justify-between items-center">
          <p className="text-default-500 text-sm">
            Showing <b>{items.length}</b> of <b>{count}</b> Results
          </p>
          <Pagination page={page} totalPages={Math.ceil(count / PAGE_SIZE)} onPageChange={p => load(p)} />
        </div>
      </div>

      {!isRollMode ? (
        <>
          <DeleteModal student={selected} onConfirm={async () => {
            await onDelete();
            if (items.length === 1 && page > 1) await load(page - 1);
            else await load(page);
          }} />
          <AddStudent
            student={editing}
            onCreated={async payload => {
              const created = await onCreate(payload);
              await load(1);
              return created;
            }}
            onUpdated={async (row, payload) => {
              await onUpdate(row, payload);
              await load(page);
            }}
            onRefresh={() => load(page)}
          />
        </>
      ) : null}
    </div>
  );
};

export default StudentTable;
