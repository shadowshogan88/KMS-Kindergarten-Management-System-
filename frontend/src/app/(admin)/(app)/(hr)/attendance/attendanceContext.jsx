import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiJson } from '@/utils/api';

const StaffAttendanceContext = createContext(null);

export const useStaffAttendance = () => {
  const ctx = useContext(StaffAttendanceContext);
  if (!ctx) throw new Error('useStaffAttendance must be used within StaffAttendanceProvider');
  return ctx;
};

export const StaffAttendanceProvider = ({ children }) => {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedEmployee = useMemo(() => employees.find(e => String(e.id) === String(employeeId)), [employees, employeeId]);

  const loadEmployees = async () => {
    try {
      const data = await apiJson('/employees/?page=1');
      setEmployees(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setEmployees([]);
    }
  };

  const loadRecords = async nextEmployeeId => {
    const id = nextEmployeeId ?? employeeId;
    if (!id) {
      setRecords([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiJson(`/staff-attendance/?employee=${encodeURIComponent(String(id))}&page=1`);
      setRecords(Array.isArray(data?.results) ? data.results : []);
    } catch (e) {
      setRecords([]);
      setError(e instanceof Error ? e.message : 'Failed to load staff attendance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  return (
    <StaffAttendanceContext
      value={{
        employees,
        employeeId,
        setEmployeeId,
        selectedEmployee,
        records,
        setRecords,
        loading,
        error,
        reload: () => loadRecords(),
      }}
    >
      {children}
    </StaffAttendanceContext>
  );
};

