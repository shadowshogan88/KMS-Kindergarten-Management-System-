import { useMemo, useState } from 'react';
import Flatpickr from 'react-flatpickr';
import { LuCheck, LuChevronLeft, LuChevronRight, LuPlus, LuSearch, LuX } from 'react-icons/lu';
import { apiJson } from '@/utils/api';
import { useStaffAttendance } from '../attendanceContext';

const toYmd = v => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const dayShort = ymd => {
  if (!ymd) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(ymd));
  } catch {
    return '';
  }
};

const minutesBetween = (start, end) => {
  if (!start || !end) return null;
  const [sh, sm] = String(start).split(':').map(Number);
  const [eh, em] = String(end).split(':').map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null;
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  const diff = e - s;
  return diff >= 0 ? diff : null;
};

const EmployeeWork = () => {
  const { employeeId, records, loading, error, reload } = useStaffAttendance();
  const [query, setQuery] = useState('');
  const [range, setRange] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    date: '',
    status: 'PRESENT',
    check_in: '',
    check_out: '',
    meal_break_minutes: 0,
    overtime_minutes: 0,
    note: ''
  });
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const [from, to] = range?.length ? [toYmd(range[0]), toYmd(range[1] || range[0])] : ['', ''];
    return (records || []).filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (!q) return true;
      return String(r.note || '').toLowerCase().includes(q) || String(r.status || '').toLowerCase().includes(q) || String(r.date || '').includes(q);
    });
  }, [records, query, range]);

  const updateStatus = async (row, nextStatus) => {
    if (!row?.id) return;
    setSavingId(row.id);
    try {
      await apiJson(`/staff-attendance/${row.id}/`, { method: 'PATCH', body: { status: nextStatus } });
      reload();
    } finally {
      setSavingId(null);
    }
  };

  const openAdd = () => {
    setAddError('');
    setAddForm({
      date: toYmd(new Date()),
      status: 'PRESENT',
      check_in: '',
      check_out: '',
      meal_break_minutes: 0,
      overtime_minutes: 0,
      note: ''
    });
    setAddOpen(true);
  };

  const submitAdd = async () => {
    setAddError('');
    if (!employeeId) {
      setAddError('Select an employee first.');
      return;
    }
    if (!addForm.date) {
      setAddError('Date is required.');
      return;
    }
    setAddSaving(true);
    try {
      await apiJson('/staff-attendance/', {
        method: 'POST',
        body: {
          employee: Number(employeeId) || employeeId,
          date: addForm.date,
          status: addForm.status,
          check_in: addForm.check_in || null,
          check_out: addForm.check_out || null,
          meal_break_minutes: Number(addForm.meal_break_minutes || 0),
          overtime_minutes: Number(addForm.overtime_minutes || 0),
          note: addForm.note || ''
        }
      });
      setAddOpen(false);
      reload();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add attendance.');
    } finally {
      setAddSaving(false);
    }
  };
  return <div className="card">
      <div className="card-header">
        <div className="flex gap-3 items-center">
          <div className="relative">
            <input value={query} onChange={e => setQuery(e.target.value)} type="text" className="ps-11 form-input form-input-sm" placeholder="Search for...." />
            <div className="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
              <LuSearch className="size-3.5 flex items-center text-default-500" />
            </div>
          </div>

          <Flatpickr options={{
          mode: 'range',
          dateFormat: 'd M, Y'
        }} value={range} onChange={setRange} className="form-input form-input-sm" placeholder="Select Date" />
        </div>

        <div className="flex gap-3 items-center">
          <button type="button" disabled={!employeeId} onClick={openAdd} className="btn btn-sm bg-primary text-white disabled:opacity-60">
            <LuPlus className="size-4 me-1" /> Add
          </button>
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
                    <th className="px-3.5 py-3 font-medium text-start">Date</th>
                    <th className="px-3.5 py-3 font-medium text-start">Check In</th>
                    <th className="px-3.5 py-3 font-medium text-start">Check Out</th>
                    <th className="px-3.5 py-3 font-medium text-start">Meal Break</th>
                    <th className="px-3.5 py-3 font-medium text-start">Work Hours</th>
                    <th className="px-3.5 py-3 font-medium text-start">Overtime</th>
                    <th className="px-3.5 py-3 font-medium text-start">Status</th>
                    <th className="px-3.5 py-3 font-medium text-start">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {loading ? <tr>
                      <td colSpan={8} className="px-3.5 py-8 text-sm text-default-500 text-center">Loading...</td>
                    </tr> : filtered.length === 0 ? <tr>
                      <td colSpan={8} className="px-3.5 py-8 text-sm text-default-500 text-center">No records</td>
                    </tr> : filtered.map(record => {
                    const diff = minutesBetween(record.check_in, record.check_out);
                    const workMinutes = diff === null ? null : Math.max(0, diff - Number(record.meal_break_minutes || 0));
                    const workHours = workMinutes === null ? '—' : `${(workMinutes / 60).toFixed(2)} Hrs`;
                    return <tr key={record.id} className="text-default-800 font-normal whitespace-nowrap">
                          <td className="px-3.5 py-3 text-sm">
                            {record.date}
                            <span className="py-0.5 px-2.5 border border-default-200 text-default-600 rounded ms-2">
                              {dayShort(record.date)}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-sm">{record.check_in || '—'}</td>
                          <td className="px-3.5 py-3 text-sm">{record.check_out || '—'}</td>
                          <td className="px-3.5 py-3 text-sm">{Number(record.meal_break_minutes || 0)} min</td>
                          <td className="px-3.5 py-3 text-sm">{workHours}</td>
                          <td className="px-3.5 py-3 text-sm">{Number(record.overtime_minutes || 0)} min</td>
                          <td className="px-3.5 py-3 text-sm">{record.status}</td>
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-2">
                              <button disabled={savingId === record.id} type="button" onClick={() => updateStatus(record, 'PRESENT')} className="btn size-8 bg-success/10 hover:bg-success hover:text-white text-success disabled:opacity-60" title="Present">
                                <LuCheck className="size-4" />
                              </button>
                              <button disabled={savingId === record.id} type="button" onClick={() => updateStatus(record, 'ABSENT')} className="btn size-8 bg-danger/10 hover:bg-danger hover:text-white text-danger disabled:opacity-60" title="Absent">
                                <LuX className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card-footer">
          <p className="text-default-500 text-sm">
            Showing <b>{filtered.length}</b> Results
          </p>
          <nav className="flex items-center gap-2" aria-label="Pagination">
            <button type="button" className="btn btn-sm border bg-transparent border-default-200 text-default-600 hover:bg-primary/10 hover:text-primary hover:border-primary/10" disabled>
              <LuChevronLeft className="size-4 me-1" /> Prev
            </button>
            <button type="button" className="btn size-7.5 bg-primary text-white" disabled>
              1
            </button>
            <button type="button" className="btn btn-sm border bg-transparent border-default-200 text-default-600 hover:bg-primary/10 hover:text-primary hover:border-primary/10" disabled>
              Next <LuChevronRight className="size-4 ms-1" />
            </button>
          </nav>
        </div>
      </div>

      {addOpen && <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg card border border-default-200 shadow-2xs rounded-xl">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-base text-default-800">Add Attendance</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="text-default-700 hover:text-default-900" aria-label="Close">
                <LuX className="size-5" />
              </button>
            </div>
            <div className="card-body">
              {addError ? <div className="mb-3 text-sm text-danger">{addError}</div> : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">Date</label>
                  <input type="date" className="form-input" value={addForm.date} onChange={e => setAddForm(f => ({
                  ...f,
                  date: e.target.value
                }))} />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">Status</label>
                  <select className="form-input" value={addForm.status} onChange={e => setAddForm(f => ({
                  ...f,
                  status: e.target.value
                }))}>
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="LEAVE">LEAVE</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">Check In</label>
                  <input type="time" className="form-input" value={addForm.check_in} onChange={e => setAddForm(f => ({
                  ...f,
                  check_in: e.target.value
                }))} />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">Check Out</label>
                  <input type="time" className="form-input" value={addForm.check_out} onChange={e => setAddForm(f => ({
                  ...f,
                  check_out: e.target.value
                }))} />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">Meal Break (min)</label>
                  <input type="number" className="form-input" value={addForm.meal_break_minutes} onChange={e => setAddForm(f => ({
                  ...f,
                  meal_break_minutes: e.target.value
                }))} />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-default-700">Overtime (min)</label>
                  <input type="number" className="form-input" value={addForm.overtime_minutes} onChange={e => setAddForm(f => ({
                  ...f,
                  overtime_minutes: e.target.value
                }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="block mb-2 text-sm font-medium text-default-700">Note</label>
                  <input type="text" className="form-input" value={addForm.note} onChange={e => setAddForm(f => ({
                  ...f,
                  note: e.target.value
                }))} />
                </div>
              </div>
            </div>
            <div className="card-footer flex justify-end gap-2">
              <button type="button" onClick={() => setAddOpen(false)} className="btn bg-transparent border-0 text-danger hover:bg-danger/10">
                Cancel
              </button>
              <button type="button" disabled={addSaving} onClick={submitAdd} className="btn bg-primary text-white disabled:opacity-60">
                {addSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>}
    </div>;
};
export default EmployeeWork;
