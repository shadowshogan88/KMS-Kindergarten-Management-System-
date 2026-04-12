import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LuChevronLeft, LuChevronRight, LuInfo, LuSearch } from 'react-icons/lu';
import { apiJson } from '@/utils/api';

const pageSize = 10;

const statusLabel = status => {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'DECLINED') return 'Declined';
  if (status === 'NEW') return 'New';
  return 'Pending';
};

const statusClass = status => {
  const s = statusLabel(status);
  if (s === 'Approved') return 'inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded text-xs font-medium bg-success/15 text-success';
  if (s === 'Pending') return 'inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded text-xs font-medium bg-warning/15 text-warning';
  if (s === 'Declined') return 'inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded text-xs font-medium bg-danger/10 text-danger';
  return 'inline-flex items-center gap-x-1.5 py-0.5 px-2.5 rounded text-xs font-medium bg-secondary/10 text-secondary';
};

const EmpLeave = () => {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalPages = useMemo(() => Math.max(1, Math.ceil((count || 0) / pageSize)), [count]);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const data = await apiJson('/employees/?page=1');
        setEmployees(Array.isArray(data?.results) ? data.results : []);
      } catch {
        setEmployees([]);
      }
    };
    loadEmployees();
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      if (query.trim()) qs.set('search', query.trim());
      if (employeeId) qs.set('employee', employeeId);
      const data = await apiJson(`/leave-requests/?${qs.toString()}`);
      setRows(Array.isArray(data?.results) ? data.results : []);
      setCount(Number(data?.count || 0));
    } catch (e) {
      setRows([]);
      setCount(0);
      setError(e instanceof Error ? e.message : 'Failed to load leave requests.');
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
  }, [query, employeeId]);

  return <div className="grid grid-cols-1 gap-5 mb-5">
      <div className="card">
        <div className="card-header">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <input value={query} onChange={e => setQuery(e.target.value)} type="text" className="ps-11 form-input form-input-sm" placeholder="Search for...." />
              <div className="absolute inset-y-0 start-0 flex items-center ps-3">
                <LuSearch className="size-4 flex items-center text-default-500" />
              </div>
            </div>
            <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="form-input form-input-sm">
              <option value="">All employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>
                  {e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.code}
                </option>)}
            </select>
            <Link to="/portal/create-leave-employee" className="btn btn-sm bg-primary text-white">
              Apply Leave
            </Link>
          </div>
        </div>

        <div className="flex flex-col">
          {error ? <div className="px-6 pt-4 text-sm text-danger">{error}</div> : null}
          <div className="overflow-x-auto">
            <div className="min-w-full inline-block align-middle">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-default-200">
                  <thead className="bg-default-150">
                    <tr className="text-sm font-normal whitespace-nowrap text-default-500">
                      <th className="px-3.5 py-3 text-start">#</th>
                      <th className="px-3.5 py-3 text-start">Employee</th>
                      <th className="px-3.5 py-3 text-start">Leave Type</th>
                      <th className="px-3.5 py-3 text-start">Reason</th>
                      <th className="px-3.5 py-3 text-start">No Of Days</th>
                      <th className="px-3.5 py-3 text-start">From</th>
                      <th className="px-3.5 py-3 text-start">To</th>
                      <th className="px-3.5 py-3 text-start">Status</th>
                      <th className="px-3.5 py-3 text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                    {loading ? <tr>
                        <td colSpan={9} className="px-3.5 py-8 text-sm text-default-500 text-center">Loading...</td>
                      </tr> : rows.length === 0 ? <tr>
                        <td colSpan={9} className="px-3.5 py-8 text-sm text-default-500 text-center">No leave requests</td>
                      </tr> : rows.map((row, idx) => <tr key={row.id} className="text-default-800 font-normal whitespace-nowrap">
                        <td className="px-3.5 py-2.5 text-sm">
                          {String((page - 1) * pageSize + idx + 1).padStart(2, '0')}
                        </td>
                        <td className="px-3.5 py-2.5 text-sm">{row.employee_name || row.employee_code || '-'}</td>
                        <td className="px-3.5 py-2.5 text-sm">{row.leave_type}</td>
                        <td className="px-3.5 py-2.5 text-sm">{row.reason || '-'}</td>
                        <td className="px-3.5 py-2.5 text-sm">{row.no_of_days ?? '-'}</td>
                        <td className="px-3.5 py-2.5 text-sm">{row.start_date}</td>
                        <td className="px-3.5 py-2.5 text-sm">{row.end_date}</td>
                        <td className="px-3.5 py-2.5">
                          <span className={statusClass(row.status)}>{statusLabel(row.status)}</span>
                        </td>
                        <td className="px-3.5 py-2.5 flex items-center justify-end gap-2">
                          <Link to="#" className="btn size-8 bg-primary/20 hover:bg-primary text-primary hover:text-white" title="Details">
                            <LuInfo className="size-4" />
                          </Link>
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card-footer">
            <p className="text-default-500 text-sm">
              Showing <b>{rows.length}</b> of <b>{count || rows.length}</b> Results
            </p>
            <nav className="flex items-center gap-2" aria-label="Pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn btn-sm border bg-transparent border-default-200 text-default-600 hover:bg-primary/10 hover:text-primary hover:border-primary/10 disabled:opacity-50">
                <LuChevronLeft className="size-4 me-1" /> Prev
              </button>
              <span className="text-sm text-default-600 px-2">
                Page <b>{page}</b> / <b>{totalPages}</b>
              </span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn btn-sm border bg-transparent border-default-200 text-default-600 hover:bg-primary/10 hover:text-primary hover:border-primary/10 disabled:opacity-50">
                Next <LuChevronRight className="size-4 ms-1" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>;
};
export default EmpLeave;
