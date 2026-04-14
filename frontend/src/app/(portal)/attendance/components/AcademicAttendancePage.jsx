import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LuCheck, LuSearch, LuX } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

import MiniCalendar from '@/app/(portal)/live-class/components/MiniCalendar';

const pad2 = n => String(n).padStart(2, '0');
const toLocalDateStr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const monthStartEnd = monthDate => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
};

const AcademicAttendancePage = () => {
  const [flash, setFlash] = useState('');
  const [error, setError] = useState('');

  const [classOptions, setClassOptions] = useState([]);
  const [selectedClassKey, setSelectedClassKey] = useState('');

  const [date, setDate] = useState(() => toLocalDateStr(new Date()));
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [calendarItems, setCalendarItems] = useState([]);
  const [holidayCalendarItems, setHolidayCalendarItems] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [search, setSearch] = useState('');

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
      .then(data => {
        if (!mounted) return;
        setClassOptions(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load classes.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const loadSheet = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    if (!selectedParts.school_class || !date) {
      setSheet(null);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('class', String(selectedParts.school_class));
      if (selectedParts.section) qs.set('section', String(selectedParts.section));
      qs.set('date', String(date));
      const data = await apiJson(`/academic-attendance/sheet/?${qs.toString()}`);
      setSheet(data || null);
    } catch (e) {
      setSheet(null);
      setError(e instanceof Error ? e.message : 'Failed to load attendance sheet.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCalendar = async m => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    if (!selectedParts.school_class) {
      setCalendarItems([]);
      return;
    }

    try {
      const { start, end } = monthStartEnd(m);
      const qs = new URLSearchParams();
      qs.set('class', String(selectedParts.school_class));
      if (selectedParts.section) qs.set('section', String(selectedParts.section));
      qs.set('start', start);
      qs.set('end', end);
      const data = await apiJson(`/academic-attendance/calendar/?${qs.toString()}`);
      setCalendarItems(Array.isArray(data) ? data : []);
    } catch {
      setCalendarItems([]);
    }
  };

  const loadHolidayCalendar = async m => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    try {
      const { start, end } = monthStartEnd(m);
      const qs = new URLSearchParams();
      qs.set('start', start);
      qs.set('end', end);
      const data = await apiJson(`/holiday-calendar/?${qs.toString()}`);
      setHolidayCalendarItems(Array.isArray(data) ? data : []);
    } catch {
      setHolidayCalendarItems([]);
    }
  };

  useEffect(() => {
    loadSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParts.school_class, selectedParts.section, date]);

  useEffect(() => {
    loadCalendar(month);
    loadHolidayCalendar(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParts.school_class, selectedParts.section, month]);

  const students = useMemo(() => {
    const list = Array.isArray(sheet?.students) ? sheet.students : [];
    const q = (search || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(s => String(s?.name || '').toLowerCase().includes(q));
  }, [sheet?.students, search]);

  const holidayInfo = sheet?.holiday || null;
  const isHoliday = Boolean(sheet?.is_holiday);
  const attendanceDisabled = Boolean(sheet?.attendance_disabled);

  const bulkUpdate = async ({ nextStatusForAll } = {}) => {
    if (!sheet?.school_class || !sheet?.date) return;
    if (attendanceDisabled) {
      setFlash(`Break for Holiday: ${holidayInfo?.title || 'Holiday'}`);
      return;
    }
    const items = (Array.isArray(sheet?.students) ? sheet.students : []).map(s => ({
      student: s.id,
      status: nextStatusForAll,
      note: s.note || '',
    }));

    await apiJson('/academic-attendance/bulk/', {
      method: 'POST',
      body: {
        class: sheet.school_class,
        section: sheet.section || '',
        date: sheet.date,
        items,
      },
    });
  };

  const setStudentStatus = async (studentId, status) => {
    if (!sheet?.school_class || !sheet?.date) return;
    await apiJson('/academic-attendance/bulk/', {
      method: 'POST',
      body: {
        class: sheet.school_class,
        section: sheet.section || '',
        date: sheet.date,
        items: [{ student: studentId, status, note: '' }],
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="card-header flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h6 className="card-title">Attendance</h6>
          <div className="w-full sm:w-[520px] grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="attendance-class" className="sr-only">
                Class
              </label>
              <select
                id="attendance-class"
                name="typeSelect"
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
              <label htmlFor="attendance-date" className="sr-only">
                Date
              </label>
              <input
                id="attendance-date"
                type="date"
                className="form-input"
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={!selectedParts.school_class}
              />
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
        <div className="p-5 grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div className="lg:col-span-1 card border border-default-200 shadow-2xs rounded-xl">
            <div className="card-body">
              <div className="text-center">
                <div className="mx-auto rounded-full size-20 bg-default-100 overflow-hidden">
                  <img alt="" className="h-20 w-20 object-cover rounded-full" src="/src/assets/images/user/user-3.jpg" />
                </div>
                <h6 className="mt-3 mb-1 text-base text-heading font-semibold">
                  {sheet?.school_class_label ? (
                    <span>
                      {sheet.school_class_label}
                      {sheet.section ? ` (${sheet.section})` : ''}
                    </span>
                  ) : (
                    <span className="text-default-500">Select class</span>
                  )}
                </h6>
                <p className="text-default-500">
                  {sheet?.teacher?.name ? `Teacher: ${sheet.teacher.name}` : 'Teacher: -'}
                </p>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full mb-0">
                  <tbody>
                    <tr>
                      <td className="py-2.5 text-default-500">Date</td>
                      <td className="py-2.5 font-semibold">{sheet?.date || '-'}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-default-500">Total Students</td>
                      <td className="py-2.5 font-semibold">{Array.isArray(sheet?.students) ? sheet.students.length : '-'}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-default-500">Marked</td>
                      <td className="py-2.5 font-semibold">
                        {Array.isArray(sheet?.students) ? sheet.students.filter(s => s.status).length : '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <MiniCalendar
              month={month}
              items={[...(Array.isArray(calendarItems) ? calendarItems : []), ...(Array.isArray(holidayCalendarItems) ? holidayCalendarItems : [])]}
              selectedDate={date}
              onMonthChange={setMonth}
              onDateSelect={setDate}
            />
          </div>

          <div className="lg:col-span-2 card border border-default-200 shadow-2xs rounded-xl">
            <div className="card-header">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex gap-3 items-center">
                  <div className="relative w-full sm:w-[260px]">
                    <input
                      className="ps-11 form-input form-input-sm"
                      placeholder="Search student..."
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      disabled={!sheet}
                    />
                    <div className="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
                      <LuSearch className="size-3.5 flex items-center text-default-500" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 items-center">
                  <button
                    type="button"
                    className="border btn btn-sm border-dashed border-danger text-danger bg-transparent ease-linear hover:bg-red-50"
                    disabled={!sheet || isLoading || attendanceDisabled}
                    onClick={async () => {
                      setFlash('');
                      try {
                        await bulkUpdate({ nextStatusForAll: 'ABSENT' });
                        setFlash('Marked all as absent.');
                        await loadSheet();
                        await loadCalendar(month);
                      } catch (e) {
                        setFlash(e instanceof Error ? e.message : 'Failed.');
                      }
                    }}
                  >
                    Reject All
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm bg-primary text-white"
                    disabled={!sheet || isLoading || attendanceDisabled}
                    onClick={async () => {
                      setFlash('');
                      try {
                        await bulkUpdate({ nextStatusForAll: 'PRESENT' });
                        setFlash('Marked all as present.');
                        await loadSheet();
                        await loadCalendar(month);
                      } catch (e) {
                        setFlash(e instanceof Error ? e.message : 'Failed.');
                      }
                    }}
                  >
                    Approve All
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="overflow-x-auto">
                <div className="min-w-full inline-block align-middle">
                  <div className="overflow-hidden">
                    <table className="min-w-full divide-y divide-default-200">
                      <thead className="bg-default-100 font-normal whitespace-nowrap">
                        <tr className="text-sm text-default-800">
                          <th className="px-3.5 py-3 font-medium text-start">Roll</th>
                          <th className="px-3.5 py-3 font-medium text-start">Student</th>
                          <th className="px-3.5 py-3 font-medium text-start">Status</th>
                          <th className="px-3.5 py-3 font-medium text-start">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-default-200">
                        {!selectedParts.school_class ? (
                          <tr className="text-default-800 font-normal whitespace-nowrap">
                            <td className="px-3.5 py-4 text-sm" colSpan={4}>
                              Select a class to take attendance.
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

                        {selectedParts.school_class && !isLoading && sheet && !attendanceDisabled && students.length === 0 ? (
                          <tr className="text-default-800 font-normal whitespace-nowrap">
                            <td className="px-3.5 py-4 text-sm" colSpan={4}>
                              No students found.
                            </td>
                          </tr>
                        ) : null}

                        {selectedParts.school_class && !isLoading && sheet && attendanceDisabled ? (
                          <tr className="text-default-800 font-normal whitespace-nowrap">
                            <td className="px-3.5 py-4 text-sm" colSpan={4}>
                              <div className="rounded-md border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                                <div className="font-semibold">Break for Holiday: {holidayInfo?.title || 'Holiday'}</div>
                                {holidayInfo?.description ? <div className="mt-1 text-xs text-default-700">{holidayInfo.description}</div> : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}

                        {!attendanceDisabled
                          ? students.map(s => (
                              <tr key={s.id} className="text-default-800 font-normal whitespace-nowrap">
                                <td className="px-3.5 py-3 text-sm">{s.roll_no || '-'}</td>
                                <td className="px-3.5 py-3 text-sm">{s.name}</td>
                                <td className="px-3.5 py-3 text-sm">
                                  {s.status ? (
                                    <span
                                      className={[
                                        'py-0.5 px-2.5 border rounded',
                                        s.status === 'PRESENT'
                                          ? 'border-success/20 text-success bg-success/10'
                                          : s.status === 'ABSENT'
                                            ? 'border-danger/20 text-danger bg-danger/10'
                                            : 'border-warning/20 text-warning bg-warning/10',
                                      ].join(' ')}
                                    >
                                      {s.status}
                                    </span>
                                  ) : (
                                    <span className="text-default-500">-</span>
                                  )}
                                </td>
                                <td className="px-3.5 py-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      className="btn size-8 bg-success/10 hover:bg-success hover:text-white text-success"
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await setStudentStatus(s.id, 'PRESENT');
                                          await loadSheet();
                                          await loadCalendar(month);
                                        } catch (e) {
                                          setFlash(e instanceof Error ? e.message : 'Failed.');
                                        }
                                      }}
                                    >
                                      <LuCheck className="size-4" />
                                    </button>
                                    <button
                                      className="btn size-8 bg-danger/10 hover:bg-danger hover:text-white text-danger"
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await setStudentStatus(s.id, 'ABSENT');
                                          await loadSheet();
                                          await loadCalendar(month);
                                        } catch (e) {
                                          setFlash(e instanceof Error ? e.message : 'Failed.');
                                        }
                                      }}
                                    >
                                      <LuX className="size-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="card-footer">
                <p className="text-default-500 text-sm">
                  Showing <b>{sheet && !attendanceDisabled ? students.length : 0}</b> Results
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcademicAttendancePage;
