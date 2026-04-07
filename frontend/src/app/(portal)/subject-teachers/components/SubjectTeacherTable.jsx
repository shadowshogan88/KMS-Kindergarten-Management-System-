import { useEffect, useState } from 'react';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { Link } from 'react-router';

import AddSubjectTeacher from './AddSubjectTeacher';
import DeleteModal from './DeleteModal';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { openOverlay } from '@/utils/overlay';
import Pagination from '@/components/Pagination';

const SubjectTeacherTable = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [flash, setFlash] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  const load = async nextPage => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await apiJson(`/subject-teachers/?page=${nextPage}`);
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(results);
      setCount(typeof data?.count === 'number' ? data.count : results.length);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subject teachers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const openAddModal = () => {
    setEditing(null);
    requestAnimationFrame(() => openOverlay('#subject-teacher-edit-modal'));
  };
  const openEditModal = row => {
    setEditing(row);
    requestAnimationFrame(() => openOverlay('#subject-teacher-edit-modal'));
  };
  const openDeleteModal = row => {
    setSelected(row);
    requestAnimationFrame(() => openOverlay('#subject-teacher-delete-modal'));
  };

  const onCreate = async payload => {
    const created = await apiJson('/subject-teachers/', { method: 'POST', body: payload });
    setItems(prev => [created, ...prev].slice(0, 10));
    setCount(prev => prev + 1);
    setFlash('Subject teacher added successfully.');
    return created;
  };
  const onUpdate = async (row, payload) => {
    const updated = await apiJson(`/subject-teachers/${row.id}/`, { method: 'PATCH', body: payload });
    setItems(prev => prev.map(d => (d.id === row.id ? updated : d)));
    setFlash('Subject teacher updated successfully.');
  };
  const onDelete = async () => {
    if (!selected?.id) return;
    await apiJson(`/subject-teachers/${selected.id}/`, { method: 'DELETE' });
    setItems(prev => prev.filter(d => d.id !== selected.id));
    setSelected(null);
    setCount(prev => Math.max(0, prev - 1));
    setFlash('Subject teacher deleted successfully.');
  };

  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <h6 className="card-title">Subject Teachers</h6>
        <button
          className="btn btn-sm bg-primary text-white flex items-center gap-1"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            openAddModal();
          }}
          type="button"
        >
          <LuPlus className="size-4" /> Add Subject Teacher
        </button>
      </div>

      <div className="flex flex-col">
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
                  Ã—
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {!authStorage.getAccess() ? (
          <div className="px-5 py-4 text-sm text-default-600">
            Please sign in from <Link className="text-primary underline" to="/portal">Portal</Link> to load subject teachers from backend.
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
                    <th className="px-3.5 py-3 text-start">Code</th>
                    <th className="px-3.5 py-3 text-start">Teacher Name</th>
                    <th className="px-3.5 py-3 text-start">Phone</th>
                    <th className="px-3.5 py-3 text-start">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-default-200">
                  {isLoading ? (
                    <tr className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-4 text-sm" colSpan={5}>
                        Loading...
                      </td>
                    </tr>
                  ) : null}

                  {!isLoading && items.length === 0 ? (
                    <tr className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-4 text-sm" colSpan={5}>
                        No subject teachers found.
                      </td>
                    </tr>
                  ) : null}

                  {items.map(row => (
                    <tr key={row.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                      <td className="px-3.5 py-3 text-sm">{row.id}</td>
                      <td className="px-3.5 py-3 text-sm">{row.teacher_code || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">{row.name}</td>
                      <td className="px-3.5 py-3 text-sm">{row.phone || '-'}</td>
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
                            aria-controls="subject-teacher-edit-modal"
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
                            aria-controls="subject-teacher-delete-modal"
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

        <div className="card-footer flex justify-between items-center">
          <p className="text-default-500 text-sm">
            Showing <b>{items.length}</b> of <b>{count}</b> Results
          </p>
          <Pagination page={page} totalPages={Math.ceil(count / 8)} onPageChange={p => load(p)} />
        </div>
      </div>

      <DeleteModal subjectTeacher={selected} onConfirm={async () => {
        await onDelete();
        if (items.length === 1 && page > 1) await load(page - 1);
        else await load(page);
      }} />
      <AddSubjectTeacher subjectTeacher={editing} onCreated={async p => {
        await onCreate(p);
        await load(1);
      }} onUpdated={async (d, p) => {
        await onUpdate(d, p);
        await load(page);
      }} onRefresh={() => load(page)} />
    </div>
  );
};

export default SubjectTeacherTable;
