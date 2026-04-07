import { useEffect, useState } from 'react';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { Link } from 'react-router';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { openOverlay } from '@/utils/overlay';
import Pagination from '@/components/Pagination';

import AddStudent from './AddStudent';
import DeleteModal from './DeleteModal';

const StudentTable = () => {
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
      const data = await apiJson(`/students/?page=${nextPage}`);
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(results);
      setCount(typeof data?.count === 'number' ? data.count : results.length);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load students.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

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

  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <h6 className="card-title">Students</h6>
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
                    <th className="px-3.5 py-3 text-start">Email</th>
                    <th className="px-3.5 py-3 text-start">Phone</th>
                    <th className="px-3.5 py-3 text-start">Class</th>
                    <th className="px-3.5 py-3 text-start">Section</th>
                    <th className="px-3.5 py-3 text-start">Username</th>
                    <th className="px-3.5 py-3 text-start">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-default-200">
                  {isLoading ? (
                    <tr className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-4 text-sm" colSpan={8}>
                        Loading...
                      </td>
                    </tr>
                  ) : null}

                  {!isLoading && items.length === 0 ? (
                    <tr className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-4 text-sm" colSpan={8}>
                        No students found.
                      </td>
                    </tr>
                  ) : null}

                  {items.map(row => (
                    <tr key={row.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                      <td className="px-3.5 py-3 text-sm">{row.id}</td>
                      <td className="px-3.5 py-3 text-sm">{`${row.first_name || ''} ${row.last_name || ''}`.trim() || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">{row.user_email || row.email || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">{row.phone || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">{row.school_class_label || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">{row.section || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">{row.user_username || '-'}</td>
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
    </div>
  );
};

export default StudentTable;

