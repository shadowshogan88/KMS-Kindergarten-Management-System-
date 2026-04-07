import { useEffect, useState } from 'react';
import { LuPlus, LuRefreshCw, LuTrash2 } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const DateHolidaysManager = () => {
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    date: '',
    title: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  const load = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await apiJson('/holidays/?page=1');
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load holidays.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createHoliday = async () => {
    setFlash('');
    setError('');
    if (!form.date) {
      setError('Date is required.');
      return;
    }
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    try {
      await apiJson('/holidays/', { method: 'POST', body: { ...form, title: form.title.trim() } });
      setFlash('Holiday added.');
      setForm({ date: '', title: '', description: '', is_active: true });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add holiday.');
    }
  };

  const deleteHoliday = async row => {
    if (!row?.id) return;
    setFlash('');
    setError('');
    try {
      await apiJson(`/holidays/${row.id}/`, { method: 'DELETE' });
      setFlash('Holiday deleted.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete holiday.');
    }
  };

  return (
    <div className="card">
      <div className="card-header flex justify-between items-center">
        <h6 className="card-title">Date Holidays</h6>
        <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={load} disabled={isLoading}>
          <LuRefreshCw className="size-4" /> Refresh
        </button>
      </div>

      <div className="p-5">
        {flash ? (
          <div className="mb-4 rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-default-800">
            {flash}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div>
            <label className="inline-block mb-2 text-base font-medium">Date</label>
            <input
              type="date"
              className="form-input"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="lg:col-span-2">
            <label className="inline-block mb-2 text-base font-medium">Title</label>
            <input
              className="form-input"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Eid-ul-Fitr"
            />
          </div>
          <div className="flex items-end gap-3">
            <button type="button" className="btn bg-primary text-white w-full flex items-center justify-center gap-2" onClick={createHoliday}>
              <LuPlus className="size-4" /> Add
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="inline-block mb-2 text-base font-medium">Description (optional)</label>
          <textarea
            className="form-input"
            rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Optional note"
          />
          <label className="mt-3 inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="form-checkbox rounded"
              checked={Boolean(form.is_active)}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            />
            <span className="text-sm text-default-700">Active</span>
          </label>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-default-200">
            <thead className="bg-default-100 font-normal whitespace-nowrap">
              <tr className="text-sm text-default-800">
                <th className="px-3.5 py-3 font-medium text-start">Date</th>
                <th className="px-3.5 py-3 font-medium text-start">Title</th>
                <th className="px-3.5 py-3 font-medium text-start">Active</th>
                <th className="px-3.5 py-3 font-medium text-start">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default-200">
              {isLoading ? (
                <tr className="text-default-800 font-normal whitespace-nowrap">
                  <td className="px-3.5 py-4 text-sm" colSpan={4}>
                    Loading...
                  </td>
                </tr>
              ) : null}

              {!isLoading && items.length === 0 ? (
                <tr className="text-default-800 font-normal whitespace-nowrap">
                  <td className="px-3.5 py-4 text-sm" colSpan={4}>
                    No holidays found.
                  </td>
                </tr>
              ) : null}

              {items.map(row => (
                <tr key={row.id} className="text-default-800 font-normal whitespace-nowrap">
                  <td className="px-3.5 py-3 text-sm">{row.date}</td>
                  <td className="px-3.5 py-3 text-sm">
                    <div className="font-medium">{row.title}</div>
                    {row.description ? <div className="text-xs text-default-500 mt-0.5">{row.description}</div> : null}
                  </td>
                  <td className="px-3.5 py-3 text-sm">{row.is_active ? 'Yes' : 'No'}</td>
                  <td className="px-3.5 py-3 text-sm">
                    <button
                      type="button"
                      className="btn size-8 bg-default-200 hover:bg-danger/10 hover:text-danger text-default-600"
                      onClick={() => deleteHoliday(row)}
                      title="Delete"
                    >
                      <LuTrash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DateHolidaysManager;

