import Flatpickr from 'react-flatpickr';
import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '@/utils/api';

const toYmd = v => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const CreateLeave = () => {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const selectedEmployee = useMemo(() => employees.find(e => String(e.id) === String(employeeId)), [employees, employeeId]);
  const [leaveType, setLeaveType] = useState('');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const numberOfDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const diff = Math.floor((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000));
    return diff >= 0 ? diff + 1 : 0;
  }, [startDate, endDate]);

  const reset = () => {
    setEmployeeId('');
    setLeaveType('');
    setReason('');
    setStartDate('');
    setEndDate('');
    setStatus('PENDING');
    setError('');
    setSuccess('');
  };

  const submit = async () => {
    setError('');
    setSuccess('');
    if (!employeeId || !leaveType || !startDate || !endDate) {
      setError('Please select employee, leave type, and dates.');
      return;
    }
    setSaving(true);
    try {
      await apiJson('/leave-requests/', {
        method: 'POST',
        body: {
          employee: Number(employeeId) || employeeId,
          leave_type: leaveType,
          reason,
          start_date: startDate,
          end_date: endDate,
          status
        }
      });
      setSuccess('Leave request created.');
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create leave request.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="grid lg:grid-cols-4 grid-cols-1 gap-5">
      <div className="lg:col-span-3 col-span-1">
        <div className="card">
          <div className="card-header">
            <h6 className="card-title">Add Leave</h6>
          </div>

          <div className="card-body">
            {error ? <div className="mb-4 text-sm text-danger">{error}</div> : null}
            {success ? <div className="mb-4 text-sm text-success">{success}</div> : null}
            <div className="grid md:grid-cols-2 grid-cols-1 gap-5 mb-5">
              <div>
                <label htmlFor="employeeName" className="inline-block mb-2 text-sm text-default-800 font-medium">
                  Employee
                </label>
                <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="form-input">
                  <option value="">Select Employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>
                      {e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.code}
                    </option>)}
                </select>
              </div>

              <div>
                <label htmlFor="employeeId" className="inline-block mb-2 text-sm text-default-800 font-medium">
                  Employee ID
                </label>
                <input type="text" id="employeeId" className="form-input" value={selectedEmployee?.code || ''} disabled />
              </div>

              <div>
                <label htmlFor="employeeName" className="inline-block mb-2 text-sm text-default-800 font-medium">
                  Leave Type
                </label>
                <select value={leaveType} onChange={e => setLeaveType(e.target.value)} className="form-input">
                  <option value="">Select Leave Type</option>
                  <option value="Medical Leave">Medical Leave</option>
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Annual Leave">Annual Leave</option>
                </select>
              </div>

              <div>
                <label htmlFor="leaveStatus" className="inline-block mb-2 text-sm text-default-800 font-medium">
                  Status
                </label>
                <select id="leaveStatus" value={status} onChange={e => setStatus(e.target.value)} className="form-input">
                  <option value="PENDING">Pending</option>
                  <option value="NEW">New</option>
                  <option value="APPROVED">Approved</option>
                  <option value="DECLINED">Declined</option>
                </select>
              </div>

              <div>
                <label htmlFor="fromInput" className="inline-block mb-2 text-sm text-default-800 font-medium">
                  Form
                </label>
                <Flatpickr options={{
                mode: 'single',
                dateFormat: 'd M, Y'
              }} value={startDate ? [startDate] : []} onChange={dates => setStartDate(toYmd(dates?.[0]))} className="form-input" placeholder="Select Date" />
              </div>

              <div>
                <label htmlFor="toInput" className="inline-block mb-2 text-sm text-default-800 font-medium">
                  To
                </label>
                <Flatpickr options={{
                mode: 'single',
                dateFormat: 'd M, Y'
              }} value={endDate ? [endDate] : []} onChange={dates => setEndDate(toYmd(dates?.[0]))} className="form-input" placeholder="Select Date" />
              </div>

              <div>
                <label htmlFor="numberOfDayLeaves" className="inline-block mb-2 text-sm text-default-800 font-medium">
                  Number of Days
                </label>
                <input type="text" id="numberOfDayLeaves" className="form-input" value={numberOfDays ? String(numberOfDays).padStart(2, '0') : ''} disabled />
              </div>

              <div>
                <label htmlFor="" className="inline-block mb-2 text-sm text-default-800 font-medium">
                  Leave Day
                </label>
                <select className="form-input">
                  <option value="">Select Leave Day</option>
                  <option value="Full Day">Full Day</option>
                  <option value="Half Day">Half Day</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div>
                <label htmlFor="reasonInput" className="inline-block mb-2 text-sm text-default-800 font-medium">
                  Reason
                </label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} className="form-input" id="reasonInput" rows={3}></textarea>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={reset} className="btn border-0 text-danger bg-transparent hover:bg-danger/10">
                Reset
              </button>
              <button type="button" disabled={saving} onClick={submit} className="btn bg-primary text-white disabled:opacity-60">{saving ? 'Saving...' : 'Apply Leave'}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-1">
        <div className="card">
          <div className="card-header">
            <h6 className="card-title">Leave Information (2023)</h6>
          </div>
          <div className="card-body">
            <table className="w-full mb-0 text-sm">
              <tbody>
                <tr>
                  <td className="py-2.5 text-default-800">Medical Leave</td>
                  <th className="py-2.5 text-default-800 font-semibold">04</th>
                </tr>

                <tr>
                  <td className="py-2.5 text-default-800">Casual Leave</td>
                  <th className="py-2.5 text-default-800 font-semibold">08</th>
                </tr>

                <tr>
                  <td className="py-2.5 text-default-800">Sick Leave</td>
                  <th className="py-2.5 text-default-800 font-semibold">03</th>
                </tr>

                <tr>
                  <td className="py-2.5 text-default-800">Annual Leave</td>
                  <th className="py-2.5 text-default-800 font-semibold">12</th>
                </tr>

                <tr>
                  <td className="py-2.5 text-default-800">Use Leave</td>
                  <th className="py-2.5 text-default-800 font-semibold">09</th>
                </tr>

                <tr>
                  <td className="py-2.5 text-default-800">Remaining Leave</td>
                  <th className="py-2.5 text-default-800 font-semibold">18</th>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>;
};
export default CreateLeave;
