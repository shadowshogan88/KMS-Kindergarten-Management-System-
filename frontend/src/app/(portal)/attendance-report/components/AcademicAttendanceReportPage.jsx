import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LuSearch } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const pad2 = n => String(n).padStart(2, '0');
const toMonthStr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

const AcademicAttendanceReportPage = () => {
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [classOptions, setClassOptions] = useState([]);
  const [selectedClassKey, setSelectedClassKey] = useState('');
  const [month, setMonth] = useState(() => toMonthStr(new Date()));
  const [search, setSearch] = useState('');

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedParts = useMemo(() => {
    if (!selectedClassKey) return { school_class: '', section: '' };
    const [school_class, section] = String(selectedClassKey).split(':', 2);
    return { school_class: school_class || '', section: (section || '').toUpperCase() };
  }, [selectedClassKey]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;

    let mounted = true;
    setError('');
    apiJson('/academic-classes/options/')
      .then(d => {
        if (!mounted) return;
        setClassOptions(Array.isArray(d) ? d : []);
      })
      .catch(e => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load classes.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const load = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    if (!selectedParts.school_class || !month) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('class', String(selectedParts.school_class));
      if (selectedParts.section) qs.set('section', String(selectedParts.section));
      qs.set('month', month);
      const res = await apiJson(`/academic-attendance/summary/?${qs.toString()}`);
      setData(res || null);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Failed to load report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParts.school_class, selectedParts.section, month]);

  const rows = useMemo(() => {
    const list = Array.isArray(data?.students) ? data.students : [];
    const q = (search || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(s => String(s?.name || '').toLowerCase().includes(q));
  }, [data?.students, search]);

  return (
    <div className="card">
      <div className="card-header flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h6 className="card-title">Attendance Report</h6>
        <div className="w-full sm:w-[620px] grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="report-class" className="sr-only">
              Class
            </label>
            <select
              id="report-class"
              className="form-input"
              value={selectedClassKey}
              onChange={e => setSelectedClassKey(e.target.value)}
              disabled={!authStorage.getAccess()}
            >
              <option value="">{classOptions.length ? 'Select Class' : 'Loading...'}</option>
              {classOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-month" className="sr-only">
              Month
            </label>
            <input
              id="report-month"
              type="month"
              className="form-input"
              value={month}
              onChange={e => setMonth(e.target.value)}
              disabled={!selectedParts.school_class}
            />
          </div>

          <div className="relative">
            <input
              className="ps-11 form-input"
              placeholder="Search student..."
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              disabled={!data}
            />
            <div className="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
              <LuSearch className="size-4 text-default-500" />
            </div>
          </div>
        </div>
      </div>

      {!authStorage.getAccess() ? (
        <div className="p-5 text-sm text-default-600">
          Please sign in from <Link className="text-primary underline" to="/portal">Portal</Link>.
        </div>
      ) : null}

      {flash ? <div className="px-5 pt-4 text-sm text-default-800">{flash}</div> : null}
      {error ? <div className="px-5 pt-4 text-sm text-danger">{error}</div> : null}

      <div className="flex flex-col">
        <div className="overflow-x-auto">
          <div className="min-w-full inline-block align-middle">
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-default-200">
                <thead className="bg-default-100 font-normal whitespace-nowrap">
                  <tr className="text-sm text-default-800">
                    <th className="px-3.5 py-3 font-medium text-start">Student</th>
                    <th className="px-3.5 py-3 font-medium text-start">Present</th>
                    <th className="px-3.5 py-3 font-medium text-start">Absent</th>
                    <th className="px-3.5 py-3 font-medium text-start">Late</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {!selectedParts.school_class ? (
                    <tr className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-4 text-sm" colSpan={4}>
                        Select a class to view report.
                      </td>
                    </tr>
                  ) : null}

                  {selectedParts.school_class && isLoading ? (
                    <tr className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-4 text-sm" colSpan={4}>
                        Loading...
                      </td>
                    </tr>
                  ) : null}

                  {selectedParts.school_class && !isLoading && data && rows.length === 0 ? (
                    <tr className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-4 text-sm" colSpan={4}>
                        No students found.
                      </td>
                    </tr>
                  ) : null}

                  {rows.map(r => (
                    <tr key={r.id} className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-3 text-sm">{r.name}</td>
                      <td className="px-3.5 py-3 text-sm">{r.present}</td>
                      <td className="px-3.5 py-3 text-sm">{r.absent}</td>
                      <td className="px-3.5 py-3 text-sm">{r.late}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card-footer">
          <p className="text-default-500 text-sm">
            Showing <b>{data ? rows.length : 0}</b> Results
          </p>
        </div>
      </div>
    </div>
  );
};

export default AcademicAttendanceReportPage;

