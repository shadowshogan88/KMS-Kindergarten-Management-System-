import { useEffect, useMemo, useState } from 'react';
import Flatpickr from 'react-flatpickr';
import { LuCalendar, LuCheck, LuSearch, LuX } from 'react-icons/lu';
import { apiJson } from '@/utils/api';

const toYmd = v => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const EmployeeReportTabel = () => {
  const [query, setQuery] = useState('');
  const [range, setRange] = useState([]);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalPages = useMemo(() => Math.max(1, Math.ceil((count || 0) / 20)), [count]);

  const load = async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(p));
      qs.set('page_size', '20');
      if (query.trim()) qs.set('search', query.trim());
      if (range?.length) {
        const from = toYmd(range[0]);
        const to = toYmd(range[1] || range[0]);
        if (from) qs.set('date_from', from);
        if (to) qs.set('date_to', to);
      }
      const data = await apiJson(`/staff-attendance/?${qs.toString()}`);
      setRows(Array.isArray(data?.results) ? data.results : []);
      setCount(Number(data?.count || 0));
    } catch (e) {
      setRows([]);
      setCount(0);
      setError(e instanceof Error ? e.message : 'Failed to load attendance summary.');
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
      load(1);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, range]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="relative">
          <input value={query} onChange={e => setQuery(e.target.value)} type="text" className="ps-11 form-input form-input-sm" placeholder="Search for...." />
          <div className="absolute inset-y-0 start-0 flex items-center ps-3">
            <LuSearch className="size-3.5 flex items-center text-default-500" />
          </div>
        </div>

        <div className="relative">
          <Flatpickr
            options={{ mode: 'range', dateFormat: 'd M, Y' }}
            value={range}
            onChange={setRange}
            className="form-input form-input-sm ps-10"
            placeholder="Select Date"
          />
          <LuCalendar className="absolute top-1.5 start-3 size-4 flex items-center text-default-500" />
        </div>
      </div>

      <div className="flex flex-col">
        {error ? <div className="px-6 pt-4 text-sm text-danger">{error}</div> : null}
        <div className="overflow-x-auto">
          <div className="min-w-full inline-block align-middle">
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-default-200">
                <thead className="bg-default-100 font-normal whitespace-nowrap">
                  <tr className="text-sm text-default-800">
                    <th className="px-3.5 py-3 font-medium text-start">Employee</th>
                    <th className="px-3.5 py-3 font-medium text-start">Date</th>
                    <th className="px-3.5 py-3 font-medium text-start">Status</th>
                    <th className="px-3.5 py-3 font-medium text-start">Check In</th>
                    <th className="px-3.5 py-3 font-medium text-start">Check Out</th>
                    <th className="px-3.5 py-3 font-medium text-start">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-3.5 py-8 text-sm text-default-500 text-center">
                        Loading...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3.5 py-8 text-sm text-default-500 text-center">
                        No records
                      </td>
                    </tr>
                  ) : (
                    rows.map(r => (
                      <tr key={r.id} className="text-default-800 font-normal whitespace-nowrap">
                        <td className="px-3.5 py-3 text-sm">{r.employee_name || r.employee_code || '-'}</td>
                        <td className="px-3.5 py-3 text-sm">{r.date}</td>
                        <td className="px-3.5 py-3 text-sm">
                          {r.status === 'PRESENT' ? (
                            <span className="inline-flex items-center gap-2 text-success">
                              <LuCheck className="size-4" /> PRESENT
                            </span>
                          ) : r.status === 'ABSENT' ? (
                            <span className="inline-flex items-center gap-2 text-danger">
                              <LuX className="size-4" /> ABSENT
                            </span>
                          ) : (
                            r.status
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-sm">{r.check_in || '—'}</td>
                        <td className="px-3.5 py-3 text-sm">{r.check_out || '—'}</td>
                        <td className="px-3.5 py-3 text-sm">{r.note || '—'}</td>
                      </tr>
                    ))
                  )}
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
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn btn-sm border bg-transparent border-default-200 text-default-600 hover:bg-primary/10 hover:text-primary disabled:opacity-50">
              Prev
            </button>
            <span className="text-sm text-default-600 px-2">
              Page <b>{page}</b> / <b>{totalPages}</b>
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn btn-sm border bg-transparent border-default-200 text-default-600 hover:bg-primary/10 hover:text-primary disabled:opacity-50">
              Next
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default EmployeeReportTabel;

