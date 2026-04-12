import user from '@/assets/images/user/user-3.jpg';
import { Link } from 'react-router';
import { useStaffAttendance } from '../attendanceContext';
const EmployeeDetails = () => {
  const { employees, employeeId, setEmployeeId, selectedEmployee, loading, error } = useStaffAttendance();
  return <div className="col-span-1">
      <div className="mb-5">
        <label htmlFor="deliveryStatusSelect" className="inline-block card-title">
          Select Employee
        </label>
        <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} id="typeSelect" name="typeSelect" className="form-input">
          <option value="">Select Employee</option>
          {employees.map(e => <option key={e.id} value={e.id}>
              {e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.code}
            </option>)}
        </select>
        {error ? <div className="mt-2 text-xs text-danger">{error}</div> : null}
      </div>

      <div className="card">
        <div className="card-body">
          <div className="text-center">
            <div className="mx-auto rounded-full size-20 bg-default-100">
              <img src={user} alt="" className="h-20 rounded-full" />
            </div>

            <h6 className="mt-3 mb-1 text-base text-heading font-semibold">
              <Link to="#">{selectedEmployee ? selectedEmployee.full_name || `${selectedEmployee.first_name || ''} ${selectedEmployee.last_name || ''}`.trim() : loading ? 'Loading...' : 'Select employee'}</Link>
            </h6>
            <p className="text-default-500">{selectedEmployee?.designation_name || '—'}</p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full mb-0">
              <tbody>
                <tr>
                  <td className="py-2.5 text-default-500">Employee ID</td>
                  <td className="py-2.5 font-semibold">{selectedEmployee?.code || '—'}</td>
                </tr>

                <tr>
                  <td className="py-2.5 text-default-500">Experience</td>
                  <td className="py-2.5 font-semibold">—</td>
                </tr>

                <tr>
                  <td className="py-2.5 text-default-500">Joining Date</td>
                  <td className="py-2.5 font-semibold">{selectedEmployee?.join_date || '—'}</td>
                </tr>

                <tr>
                  <td className="py-2.5 text-default-500">Total Hours (Years)</td>
                  <td className="py-2.5 font-semibold">—</td>
                </tr>

                <tr>
                  <td className="py-2.5 text-default-500">Total Hours</td>
                  <td className="py-2.5 font-semibold">—</td>
                </tr>

                <tr>
                  <td className="py-2.5 text-default-500">Regular Hours</td>
                  <td className="py-2.5 font-semibold">—</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-default-500">Overtime</td>
                  <td className="py-2.5 font-semibold">—</td>
                </tr>

                <tr>
                  <td className="py-2.5 text-default-500">Holiday</td>
                  <td className="py-2.5 font-semibold">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>;
};
export default EmployeeDetails;
