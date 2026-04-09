import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LuLink2, LuPencil, LuPlus } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { openOverlay } from '@/utils/overlay';

import EditMeetTimeModal from './EditMeetTimeModal';
import LiveDateOverrideModal from './LiveDateOverrideModal';
import MiniCalendar from './MiniCalendar';

const dayTabs = [
  { label: 'Saturday', value: 0 },
  { label: 'Sunday', value: 1 },
  { label: 'Monday', value: 2 },
  { label: 'Tuesday', value: 3 },
  { label: 'Wednesday', value: 4 },
  { label: 'Thursday', value: 5 },
  { label: 'Friday', value: 6 },
];

const pad2 = n => String(n).padStart(2, '0');
const toLocalDateStr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const fmtTime = t => (t ? String(t).slice(0, 5) : '');

const LiveClassSettings = () => {
  const [flash, setFlash] = useState('');
  const [status, setStatus] = useState({ connected: false, calendar_id: '' });
  const [statusError, setStatusError] = useState('');
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const [classes, setClasses] = useState([]);
  const [schoolClass, setSchoolClass] = useState('');
  const [section, setSection] = useState('');
  const [isLoadingSchoolClasses, setIsLoadingSchoolClasses] = useState(false);
  const [classError, setClassError] = useState('');

  const [activeDay, setActiveDay] = useState(0);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingMeet, setEditingMeet] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calendarItems, setCalendarItems] = useState([]);
  const [holidayCalendarItems, setHolidayCalendarItems] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    return toLocalDateStr(new Date());
  });
  const [didPickDate, setDidPickDate] = useState(false);
  const [overrideEditing, setOverrideEditing] = useState(null);
  const [weeklyHoliday, setWeeklyHoliday] = useState(() => ({ days: [6], title: 'Weekly Holiday', is_active: true }));

  const weeklyHolidayDays = useMemo(() => {
    if (!weeklyHoliday?.is_active) return [];
    const list = Array.isArray(weeklyHoliday?.days) ? weeklyHoliday.days : [];
    const normalized = [];
    for (const d of list) {
      const n = Number(d);
      if (Number.isFinite(n) && n >= 0 && n <= 6 && !normalized.includes(n)) normalized.push(n);
    }
    return normalized;
  }, [weeklyHoliday]);
  const isWeeklyHolidayDay = useMemo(() => weeklyHolidayDays.includes(Number(activeDay)), [weeklyHolidayDays, activeDay]);
  const weeklyHolidayTitle = useMemo(() => (weeklyHoliday?.title ? String(weeklyHoliday.title) : 'Weekly Holiday'), [weeklyHoliday?.title]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const loadStatus = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    setIsLoadingStatus(true);
    setStatusError('');
    try {
      const data = await apiJson('/google/oauth/status/');
      setStatus({
        connected: Boolean(data?.connected),
        calendar_id: data?.calendar_id || '',
      });
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Failed to load Google status.');
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;

    let isMounted = true;
    apiJson('/weekly-holidays/current/')
      .then(data => {
        if (!isMounted) return;
        setWeeklyHoliday(data || null);
      })
      .catch(() => {
        // Ignore: live class settings should still work even if weekly holidays fail to load.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;

    let isMounted = true;
    setClassError('');
    setIsLoadingSchoolClasses(true);
    apiJson('/academic-classes/simple/')
      .then(data => {
        if (!isMounted) return;
        setClasses(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        if (!isMounted) return;
        setClassError(e instanceof Error ? e.message : 'Failed to load classes.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingSchoolClasses(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedClass = useMemo(() => classes.find(c => String(c?.id) === String(schoolClass)) || null, [classes, schoolClass]);
  const sectionOptions = useMemo(() => (Array.isArray(selectedClass?.sections) ? selectedClass.sections : []), [selectedClass?.sections]);

  useEffect(() => {
    if (!selectedClass) return;
    if (!sectionOptions.length) {
      if (section) setSection('');
      return;
    }
    if (section && sectionOptions.includes(section.toUpperCase())) return;
    setSection(sectionOptions[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass?.id, sectionOptions.join(',')]);

  const load = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    if (!schoolClass) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('class', String(schoolClass));
      if (sectionOptions.length && section) qs.set('section', String(section));
      const data = await apiJson(`/academic-routines/?${qs.toString()}`);
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load routines.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolClass, section]);

  useEffect(() => {
    // Allow auto-selecting a meaningful date after class/section/month changes.
    setDidPickDate(false);
  }, [schoolClass, section, calendarMonth]);

  const loadCalendar = async monthDate => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    if (!schoolClass) {
      setCalendarItems([]);
      return;
    }

    try {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      const startStr = toLocalDateStr(start);
      const endStr = toLocalDateStr(end);

      const qs = new URLSearchParams();
      qs.set('class', String(schoolClass));
      if (sectionOptions.length && section) qs.set('section', String(section));
      qs.set('start', startStr);
      qs.set('end', endStr);

      const data = await apiJson(`/live-calendar/?${qs.toString()}`);
      setCalendarItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setCalendarItems([]);
      setFlash(e instanceof Error ? e.message : 'Failed to load calendar.');
    }
  };

  const loadHolidayCalendar = async monthDate => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;

    try {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      const startStr = toLocalDateStr(start);
      const endStr = toLocalDateStr(end);

      const qs = new URLSearchParams();
      qs.set('start', startStr);
      qs.set('end', endStr);

      const data = await apiJson(`/holiday-calendar/?${qs.toString()}`);
      setHolidayCalendarItems(Array.isArray(data) ? data : []);
    } catch {
      setHolidayCalendarItems([]);
    }
  };

  useEffect(() => {
    loadCalendar(calendarMonth);
    loadHolidayCalendar(calendarMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolClass, section, calendarMonth]);

  useEffect(() => {
    if (!schoolClass) return;
    if (didPickDate) return;
    if (!Array.isArray(calendarItems) || calendarItems.length === 0) return;

    const uniqueDates = Array.from(new Set(calendarItems.map(e => e?.date).filter(Boolean))).sort();
    if (!uniqueDates.length) return;

    const todayStr = toLocalDateStr(new Date());
    const next = uniqueDates.find(d => d >= todayStr) || uniqueDates[0];

    const hasAnyOnSelected = calendarItems.some(e => e?.date === selectedDate);
    if (!hasAnyOnSelected || !selectedDate) setSelectedDate(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarItems, didPickDate, schoolClass]);

  const dayRows = useMemo(() => {
    if (isWeeklyHolidayDay) return [];
    const list = items.filter(rt => Number(rt?.day_of_week) === Number(activeDay));
    return list.sort((a, b) => String(a?.start_time || '').localeCompare(String(b?.start_time || '')));
  }, [items, activeDay, isWeeklyHolidayDay]);

  const selectedDateRows = useMemo(() => {
    return calendarItems
      .filter(e => e.date === selectedDate)
      .sort((a, b) => String(a?.start_time || '').localeCompare(String(b?.start_time || '')));
  }, [calendarItems, selectedDate]);

  const connect = async () => {
    setFlash('');
    try {
      const data = await apiJson('/google/oauth/start/');
      if (data?.auth_url) {
        window.open(data.auth_url, '_blank', 'noopener,noreferrer');
        setFlash('Google authorization opened in a new tab. Complete it, then refresh this page.');
      }
    } catch (e) {
      setFlash('');
      setStatusError(e instanceof Error ? e.message : 'Failed to start OAuth.');
    }
  };

  const setLiveEnabled = async (row, next) => {
    await apiJson(`/academic-routines/${row.id}/`, { method: 'PATCH', body: { live_enabled: Boolean(next) } });
    setItems(prev => prev.map(r => (r.id === row.id ? { ...r, live_enabled: Boolean(next) } : r)));
  };

  const generateMeet = async row => {
    const res = await apiJson(`/academic-routines/${row.id}/generate-meet/`, { method: 'POST' });
    setItems(prev =>
      prev.map(r =>
        r.id === row.id ? { ...r, live_enabled: true, meet_link: res?.meet_link || r.meet_link } : r,
      ),
    );
    setFlash('Meet link generated successfully.');
  };

  const regenerateMeet = async row => {
    const res = await apiJson(`/academic-routines/${row.id}/regenerate-meet/`, { method: 'POST' });
    setItems(prev =>
      prev.map(r =>
        r.id === row.id ? { ...r, live_enabled: true, meet_link: res?.meet_link || '' } : r,
      ),
    );
    setFlash('Meet link regenerated successfully.');
  };

  const shouldHideGenerate = row => {
    if (!row) return true;
    if (row.routine_type === 'BREAK') return true;
    if (row.subject_type === 'PRACTICAL') return true;
    if (row.meet_link) return true;
    return false;
  };

  const shouldHideLiveToggle = row => {
    if (!row) return true;
    if (row.routine_type === 'BREAK') return true;
    if (row.subject_type === 'PRACTICAL') return true;
    return false;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="card-header flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <h6 className="card-title">Google Meet Setup</h6>
          <button className="btn btn-sm bg-primary text-white flex items-center gap-1" type="button" onClick={connect} disabled={isLoadingStatus}>
            <LuPlus className="size-4" /> Connect Google
          </button>
        </div>
        <div className="p-5">
          {!authStorage.getAccess() ? (
            <div className="text-sm text-default-600">
              Please sign in from <Link className="text-primary underline" to="/portal">Portal</Link>.
            </div>
          ) : null}

          {statusError ? <div className="text-sm text-danger">{statusError}</div> : null}
          {flash ? <div className="mt-3 text-sm text-default-800">{flash}</div> : null}

          <div className="mt-3 text-sm text-default-700">
            Status:{' '}
            <span className={`font-semibold ${status.connected ? 'text-success' : 'text-danger'}`}>
              {isLoadingStatus ? 'Loading...' : status.connected ? 'Connected' : 'Not connected'}
            </span>
            {status.calendar_id ? <span className="text-default-500"> (Calendar: {status.calendar_id})</span> : null}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h6 className="card-title">Live Class by Routine</h6>
          <div className="w-full sm:w-[520px] grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="live-class-class" className="sr-only">
                Class
              </label>
              <select
                id="live-class-class"
                className="form-input"
                value={schoolClass}
                onChange={e => setSchoolClass(e.target.value)}
                disabled={isLoadingSchoolClasses}
              >
                <option value="">{isLoadingSchoolClasses ? 'Loading classes...' : 'Select class'}</option>
                {classes.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
              {classError ? <div className="mt-2 text-xs text-danger">{classError}</div> : null}
            </div>
            <div>
              <label htmlFor="live-class-section" className="sr-only">
                Section
              </label>
              <select
                id="live-class-section"
                className="form-input"
                value={section}
                onChange={e => setSection(e.target.value)}
                disabled={!schoolClass || sectionOptions.length === 0}
              >
                <option value="">{sectionOptions.length ? 'Select section' : 'No sections'}</option>
                {sectionOptions.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedClass ? (
          <div className="px-5 pt-4 text-sm text-default-600">
            Showing routine for <span className="font-semibold text-default-800">{selectedClass.name}</span>
            {section ? <span className="text-default-500"> ({section})</span> : null}
          </div>
        ) : null}

        {error ? <div className="px-5 py-4 text-sm text-danger">{error}</div> : null}

        <div className="p-5">
          {!schoolClass ? <div className="text-sm text-default-500">Select a class to manage live meetings.</div> : null}
          {schoolClass && isLoading ? <div className="text-sm text-default-500">Loading routine...</div> : null}

          {schoolClass && !isLoading ? (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {dayTabs.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    className={`btn btn-sm ${
                      weeklyHolidayDays.includes(Number(t.value))
                        ? Number(activeDay) === Number(t.value)
                          ? 'bg-warning/20 text-warning ring-1 ring-warning/30'
                          : 'bg-warning/10 text-warning hover:bg-warning/20'
                        : Number(activeDay) === Number(t.value)
                          ? 'bg-primary text-white'
                          : 'bg-default-200 text-default-700 hover:bg-default-300'
                    }`}
                    onClick={() => setActiveDay(t.value)}
                  >
                    {t.label.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-full inline-block align-middle">
                  <div className="overflow-hidden rounded-lg border border-default-200">
                    <table className="min-w-full divide-y divide-default-200">
                      <thead className="font-semibold whitespace-nowrap bg-default-50">
                        <tr className="text-sm text-default-800 divide-x divide-default-200">
                          <th className="px-3.5 py-3 text-start">SUBJECT</th>
                          <th className="px-3.5 py-3 text-start">TEACHER</th>
                          <th className="px-3.5 py-3 text-start">START</th>
                          <th className="px-3.5 py-3 text-start">END</th>
                          <th className="px-3.5 py-3 text-start">IS BREAK</th>
                          <th className="px-3.5 py-3 text-start">ROOM</th>
                          <th className="px-3.5 py-3 text-start">LIVE</th>
                          <th className="px-3.5 py-3 text-start">MEET</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-default-200">
                        {isWeeklyHolidayDay ? (
                          <tr className="text-default-800 font-normal whitespace-nowrap">
                            <td className="px-3.5 py-4 text-sm" colSpan={8}>
                              <div className="rounded-md border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                                <div className="font-semibold">Break for Holiday: {weeklyHolidayTitle}</div>
                              </div>
                            </td>
                          </tr>
                        ) : !dayRows.length ? (
                          <tr className="text-default-800 font-normal whitespace-nowrap">
                            <td className="px-3.5 py-4 text-sm" colSpan={8}>
                              No routine for {dayTabs.find(d => d.value === activeDay)?.label || 'this day'}.
                            </td>
                          </tr>
                        ) : null}

                        {!isWeeklyHolidayDay
                          ? dayRows.map(row => (
                              <tr
                                key={row.id}
                                className={[
                                  'text-default-800 font-normal whitespace-nowrap divide-x divide-default-200',
                                  row.routine_type === 'BREAK' ? 'bg-warning/10' : '',
                                ].join(' ')}
                              >
                                <td className="px-3.5 py-3 text-sm">{row.subject_label || '-'}</td>
                                <td className="px-3.5 py-3 text-sm">{row.subject_teacher_label || '-'}</td>
                                <td className="px-3.5 py-3 text-sm">{fmtTime(row.start_time) || '-'}</td>
                                <td className="px-3.5 py-3 text-sm">{fmtTime(row.end_time) || '-'}</td>
                                <td
                                  className={[
                                    'px-3.5 py-3 text-sm',
                                    row.routine_type === 'BREAK' ? 'text-warning font-semibold' : '',
                                  ].join(' ')}
                                >
                                  {row.routine_type === 'BREAK' ? 'Yes' : 'No'}
                                </td>
                                <td className="px-3.5 py-3 text-sm">{row.room || '-'}</td>
                                <td className="px-3.5 py-3 text-sm">
                                  {!shouldHideLiveToggle(row) ? (
                                    <input
                                      type="checkbox"
                                      checked={Boolean(row.live_enabled)}
                                      onChange={async e => {
                                        try {
                                          await setLiveEnabled(row, e.target.checked);
                                        } catch (err) {
                                          setFlash(err instanceof Error ? err.message : 'Failed to update.');
                                        }
                                      }}
                                    />
                                  ) : (
                                    <span className="text-default-500 text-sm">-</span>
                                  )}
                                </td>
                                <td className="px-3.5 py-3 text-sm">
                                  <div className="flex items-center gap-2">
                                    {row.meet_link ? (
                                      <>
                                        <a
                                          className="text-primary underline text-sm"
                                          href={row.meet_link}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          <LuLink2 className="inline size-4" /> Open
                                        </a>
                                        <button
                                          type="button"
                                          className="btn btn-sm bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                                          onClick={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setEditingMeet(row);
                                            requestAnimationFrame(() => openOverlay('#meet-time-edit-modal'));
                                          }}
                                          aria-haspopup="dialog"
                                          aria-expanded="false"
                                          aria-controls="meet-time-edit-modal"
                                        >
                                          <LuPencil className="size-4" />
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-default-500 text-sm">-</span>
                                    )}
                                    {!shouldHideGenerate(row) ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm bg-primary text-white"
                                        disabled={!status.connected}
                                        onClick={async () => {
                                          try {
                                            await generateMeet(row);
                                            await loadStatus();
                                            await load();
                                            await loadCalendar(calendarMonth);
                                          } catch (err) {
                                            setFlash(err instanceof Error ? err.message : 'Failed to generate meet link.');
                                          }
                                        }}
                                      >
                                        Generate
                                      </button>
                                    ) : null}
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
            </>
          ) : null}
        </div>
      </div>

      <EditMeetTimeModal
        routine={editingMeet}
        onSaved={async msg => {
          setFlash(msg || 'Meeting time updated.');
          await load();
        }}
      />

      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h6 className="card-title">Calendar</h6>
          <div className="text-sm text-default-600">Date-wise classes</div>
        </div>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <MiniCalendar
              month={calendarMonth}
              items={[...(Array.isArray(calendarItems) ? calendarItems : []), ...(Array.isArray(holidayCalendarItems) ? holidayCalendarItems : [])]}
              selectedDate={selectedDate}
              onMonthChange={setCalendarMonth}
              onDateSelect={d => {
                setDidPickDate(true);
                setSelectedDate(d);
              }}
              hidePastBadges
            />
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-lg border border-default-200 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-default-200 font-semibold text-default-800">
                {selectedDate ? `Classes on ${selectedDate}` : 'Select a date'}
              </div>
              <div className="p-4 flex flex-col gap-3">
                {!schoolClass ? <div className="text-sm text-default-500">Select a class to view calendar.</div> : null}
                {schoolClass && selectedDateRows.length === 0 ? (
                  <div className="text-sm text-default-500">No classes on this date.</div>
                ) : null}

                {selectedDateRows.map(ev => (
                  ev?.is_holiday ? (
                    <div key={`${ev.date}-${ev.routine_id}`} className="rounded-md border border-warning/20 bg-warning/10 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-warning">Break for Holiday</div>
                          <div className="mt-1 text-sm text-default-800">{ev?.holiday?.title || ev.subject_label || 'Holiday'}</div>
                          {ev?.holiday?.description ? (
                            <div className="mt-1 text-xs text-default-600">{ev.holiday.description}</div>
                          ) : null}
                        </div>
                        <div className="text-xs text-default-600">{ev?.holiday?.kind === 'WEEKLY' ? 'Weekly' : 'Holiday'}</div>
                      </div>
                    </div>
                  ) : (
                  <div key={`${ev.date}-${ev.routine_id}`} className="rounded-md border border-default-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-default-800">
                          {fmtTime(ev.start_time)} - {fmtTime(ev.end_time)}
                          {ev.is_override ? <span className="ml-2 text-xs text-warning">Override</span> : null}
                        </div>
                        <div className="mt-1 text-sm text-default-800">{ev.subject_label || '-'}</div>
                        {ev.subject_teacher_label ? (
                          <div className="mt-1 text-xs text-default-600">Teacher: {ev.subject_teacher_label}</div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        {ev.meet_link ? (
                          <a className="text-primary underline text-sm" href={ev.meet_link} target="_blank" rel="noreferrer">
                            <LuLink2 className="inline size-4" /> Open
                          </a>
                        ) : (
                          <span className="text-default-500 text-sm">-</span>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                          onClick={() => {
                            setOverrideEditing(ev);
                            requestAnimationFrame(() => openOverlay('#live-override-modal'));
                          }}
                          disabled={ev.routine_type === 'BREAK' || ev.subject_type === 'PRACTICAL'}
                        >
                          <LuPencil className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <LiveDateOverrideModal
        event={overrideEditing}
        status={status}
        onSaved={async msg => {
          setFlash(msg || 'Saved.');
          await loadCalendar(calendarMonth);
          await load();
        }}
      />
    </div>
  );
};

export default LiveClassSettings;
