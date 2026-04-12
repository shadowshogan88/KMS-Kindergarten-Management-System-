import { useEffect, useMemo, useState } from 'react';
import dummyUser from '@/assets/images/user/user-dummy-img.jpg';
import { LuChevronLeft, LuChevronRight, LuPlus, LuSearch, LuSquarePen, LuTrash2, LuX } from 'react-icons/lu';
import { apiJson } from '@/utils/api';

const pageSize = 10;

const emptyForm = {
  code: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  join_date: ''
};

const EmployeeDetails = () => {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [createSaving, setCreateSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((count || 0) / pageSize)), [count]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      if (query.trim()) qs.set('search', query.trim());
      const data = await apiJson(`/employees/?${qs.toString()}`);
      setRows(Array.isArray(data?.results) ? data.results : []);
      setCount(Number(data?.count || 0));
    } catch (e) {
      setRows([]);
      setCount(0);
      setError(e instanceof Error ? e.message : 'Failed to load employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const openCreate = () => {
    setCreateForm(emptyForm);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const payload = {
      code: createForm.code.trim(),
      first_name: createForm.first_name.trim(),
      last_name: createForm.last_name.trim(),
      email: createForm.email.trim(),
      phone: createForm.phone.trim(),
      join_date: createForm.join_date || null
    };
    if (!payload.code || !payload.first_name) {
      setError('Employee code and first name are required.');
      return;
    }
    setCreateSaving(true);
    setError('');
    try {
      await apiJson('/employees/', { method: 'POST', body: payload });
      setCreateOpen(false);
      setPage(1);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create employee.');
    } finally {
      setCreateSaving(false);
    }
  };

  const openEdit = row => {
    setEditingId(row?.id ?? null);
    setEditForm({
      code: row?.code || '',
      first_name: row?.first_name || '',
      last_name: row?.last_name || '',
      email: row?.email || '',
      phone: row?.phone || '',
      join_date: row?.join_date || ''
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editingId) return;
    const payload = {
      code: editForm.code.trim(),
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim(),
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      join_date: editForm.join_date || null
    };
    if (!payload.code || !payload.first_name) {
      setError('Employee code and first name are required.');
      return;
    }
    setEditSaving(true);
    setError('');
    try {
      await apiJson(`/employees/${editingId}/`, { method: 'PATCH', body: payload });
      setEditOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update employee.');
    } finally {
      setEditSaving(false);
    }
  };

  const remove = async row => {
    if (!row?.id) return;
    const ok = window.confirm(`Delete employee ${row.code || ''}?`);
    if (!ok) return;
    setError('');
    try {
      await apiJson(`/employees/${row.id}/`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete employee.');
    }
  };

  return <div className="card">
      <div className="card-header flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h6 className="card-title">Staff ({count || rows.length})</h6>
          <div className="relative">
            <input value={query} onChange={e => setQuery(e.target.value)} type="text" className="form-input form-input-sm ps-9" placeholder="Search staff..." />
            <div className="absolute inset-y-0 start-0 flex items-center ps-3">
              <LuSearch className="size-4 text-default-500" />
            </div>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="btn btn-sm bg-primary text-white flex items-center gap-1">
          <LuPlus className="size-4" /> Add Employee
        </button>
      </div>

      <div className="flex flex-col">
        {error ? <div className="px-6 pt-4 text-sm text-danger">{error}</div> : null}
        <div className="overflow-x-auto">
          <div className="min-w-full inline-block align-middle">
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-default-200">
                <thead className="bg-default-100 font-normal whitespace-nowrap">
                  <tr className="text-sm text-default-800">
                    <th className="px-3.5 py-3 font-medium text-start">Code</th>
                    <th className="px-3.5 py-3 font-medium text-start">Name</th>
                    <th className="px-3.5 py-3 font-medium text-start">Department</th>
                    <th className="px-3.5 py-3 font-medium text-start">Designation</th>
                    <th className="px-3.5 py-3 font-medium text-start">Email Id</th>
                    <th className="px-3.5 py-3 font-medium text-start">Phone Number</th>
                    <th className="px-3.5 py-3 font-medium text-start">Joining Date</th>
                    <th className="px-3.5 py-3 font-medium text-start">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {loading ? <tr>
                      <td colSpan={8} className="px-3.5 py-8 text-sm text-default-500 text-center">Loading...</td>
                    </tr> : rows.length === 0 ? <tr>
                      <td colSpan={8} className="px-3.5 py-8 text-sm text-default-500 text-center">No staff found</td>
                    </tr> : rows.map(row => <tr key={row.id} className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-3 text-sm text-primary">{row.code}</td>
                      <td className="px-3.5 py-3 text-sm">
                        <div className="flex gap-3 items-center">
                          <img src={dummyUser} alt={row.full_name || row.first_name} className="h-6 rounded-full" width={24} />
                          <h6 className="text-heading font-medium">{row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim()}</h6>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-sm">{row.department_name || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">{row.designation_name || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">{row.email || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">{row.phone || '-'}</td>
                      <td className="px-3.5 py-3 text-sm">{row.join_date || '-'}</td>
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openEdit(row)} className="flex size-8 bg-default-200 rounded-md items-center justify-center hover:bg-primary/10 hover:text-primary transition-all text-default-600">
                            <LuSquarePen className="size-4" />
                          </button>
                          <button type="button" onClick={() => remove(row)} className="flex size-8 bg-default-200 rounded-md items-center justify-center hover:bg-danger/10 hover:text-danger transition-all text-default-600">
                            <LuTrash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card-footer flex justify-between items-center">
          <p className="text-default-500 text-sm">
            Showing <b>{rows.length}</b> of <b>{count || rows.length}</b> Results
          </p>
          <nav className="flex items-center gap-2" aria-label="Pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn btn-sm border bg-transparent border-default-200 text-default-600 hover:bg-primary/10 hover:text-primary hover:border-primary/10 flex items-center gap-1 disabled:opacity-50">
              <LuChevronLeft className="size-4" /> Prev
            </button>
            <span className="text-sm text-default-600 px-2">
              Page <b>{page}</b> / <b>{totalPages}</b>
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn btn-sm border bg-transparent border-default-200 text-default-600 hover:bg-primary/10 hover:text-primary hover:border-primary/10 flex items-center gap-1 disabled:opacity-50">
              Next <LuChevronRight className="size-4" />
            </button>
          </nav>
        </div>
      </div>

      {(createOpen || editOpen) && <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg card border border-default-200 shadow-2xs rounded-xl">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-base text-default-800">
                {createOpen ? 'Add Employee' : 'Edit Employee'}
              </h3>
              <button type="button" onClick={() => {
              setCreateOpen(false);
              setEditOpen(false);
            }} aria-label="Close" className="text-default-700 hover:text-default-900">
                <LuX className="size-5" />
              </button>
            </div>

            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">Code *</label>
                  <input value={(createOpen ? createForm.code : editForm.code) || ''} onChange={e => createOpen ? setCreateForm(f => ({
                  ...f,
                  code: e.target.value
                })) : setEditForm(f => ({
                  ...f,
                  code: e.target.value
                }))} type="text" className="form-input" placeholder="EMP-001" />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">Join Date</label>
                  <input value={(createOpen ? createForm.join_date : editForm.join_date) || ''} onChange={e => createOpen ? setCreateForm(f => ({
                  ...f,
                  join_date: e.target.value
                })) : setEditForm(f => ({
                  ...f,
                  join_date: e.target.value
                }))} type="date" className="form-input" />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">First Name *</label>
                  <input value={(createOpen ? createForm.first_name : editForm.first_name) || ''} onChange={e => createOpen ? setCreateForm(f => ({
                  ...f,
                  first_name: e.target.value
                })) : setEditForm(f => ({
                  ...f,
                  first_name: e.target.value
                }))} type="text" className="form-input" />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">Last Name</label>
                  <input value={(createOpen ? createForm.last_name : editForm.last_name) || ''} onChange={e => createOpen ? setCreateForm(f => ({
                  ...f,
                  last_name: e.target.value
                })) : setEditForm(f => ({
                  ...f,
                  last_name: e.target.value
                }))} type="text" className="form-input" />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">Email</label>
                  <input value={(createOpen ? createForm.email : editForm.email) || ''} onChange={e => createOpen ? setCreateForm(f => ({
                  ...f,
                  email: e.target.value
                })) : setEditForm(f => ({
                  ...f,
                  email: e.target.value
                }))} type="email" className="form-input" placeholder="name@example.com" />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">Phone</label>
                  <input value={(createOpen ? createForm.phone : editForm.phone) || ''} onChange={e => createOpen ? setCreateForm(f => ({
                  ...f,
                  phone: e.target.value
                })) : setEditForm(f => ({
                  ...f,
                  phone: e.target.value
                }))} type="text" className="form-input" />
                </div>
              </div>
            </div>

            <div className="card-footer flex justify-end gap-2">
              <button type="button" onClick={() => {
              setCreateOpen(false);
              setEditOpen(false);
            }} className="btn bg-transparent border-0 text-danger hover:bg-danger/10">
                Cancel
              </button>
              <button type="button" disabled={createSaving || editSaving} onClick={createOpen ? submitCreate : submitEdit} className="btn bg-primary text-white disabled:opacity-60">
                {createOpen ? createSaving ? 'Saving...' : 'Create' : editSaving ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>}
    </div>;
};
export default EmployeeDetails;
