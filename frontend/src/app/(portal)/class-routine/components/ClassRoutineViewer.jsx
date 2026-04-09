import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { openOverlay } from '@/utils/overlay';

import AddAcademicRoutine from './AddAcademicRoutine';
import DeleteModal from './DeleteModal';

const fmtTime = t => {
  if (!t) return '';
  // API gives `HH:MM:SS` sometimes
  return String(t).slice(0, 5);
};

const dayTabs = [
  { label: 'Saturday', value: 0 },
  { label: 'Sunday', value: 1 },
  { label: 'Monday', value: 2 },
  { label: 'Tuesday', value: 3 },
  { label: 'Wednesday', value: 4 },
  { label: 'Thursday', value: 5 },
  { label: 'Friday', value: 6 },
];

const ClassRoutineViewer = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialClass = searchParams.get('class') || '';
  const initialSection = searchParams.get('section') || '';

  const [classes, setClasses] = useState([]);
  const [schoolClass, setSchoolClass] = useState(initialClass);
  const [section, setSection] = useState(initialSection);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [editing, setEditing] = useState(null);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [activeDay, setActiveDay] = useState(0);

  const [isLoadingSchoolClasses, setIsLoadingSchoolClasses] = useState(false);
  const [classError, setClassError] = useState('');

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
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;

    let isMounted = true;
    setIsLoadingSchoolClasses(true);
    setClassError('');
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
        // Ignore: routine page should still work even if weekly holidays fail to load.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (schoolClass) next.set('class', schoolClass);
    else next.delete('class');
    if (section) next.set('section', section);
    else next.delete('section');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolClass, section]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    if (!schoolClass) {
      setItems([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError('');
    const qs = new URLSearchParams();
    qs.set('class', schoolClass);
    if (section) qs.set('section', section);
    apiJson(`/academic-routines/?${qs.toString()}`)
      .then(data => {
        if (!isMounted) return;
        const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        setItems(results);
      })
      .catch(e => {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load routines.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [schoolClass, section]);

  const dayRows = useMemo(() => {
    if (isWeeklyHolidayDay) return [];
    const list = items.filter(rt => Number(rt?.day_of_week) === Number(activeDay));
    return list.sort((a, b) => String(a?.start_time || '').localeCompare(String(b?.start_time || '')));
  }, [items, activeDay, isWeeklyHolidayDay]);

  const selectedClass = useMemo(() => classes.find(c => String(c?.id) === String(schoolClass)) || null, [classes, schoolClass]);
  const sectionOptions = useMemo(() => (Array.isArray(selectedClass?.sections) ? selectedClass.sections : []), [selectedClass?.sections]);

  useEffect(() => {
    if (!selectedClass) return;
    const hasSections = sectionOptions.length > 0;
    if (!hasSections) {
      if (section) setSection('');
      return;
    }
    if (section && sectionOptions.includes(section.toUpperCase())) return;
    setSection(sectionOptions[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass?.id, sectionOptions.join(',')]);

  return (
    <div className="card">
      <div className="card-header flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h6 className="card-title">Class Routine</h6>
        <div className="w-full sm:w-[520px] grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="routine-class" className="sr-only">
              Class
            </label>
            <select
              id="routine-class"
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
          </div>

          <div>
            <label htmlFor="routine-section" className="sr-only">
              Section
            </label>
            <select
              id="routine-section"
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

          {classError ? <div className="sm:col-span-2 mt-1 text-xs text-danger">{classError}</div> : null}
        </div>

        <button
          className="btn btn-sm bg-primary text-white flex items-center gap-1"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            setEditing(null);
            requestAnimationFrame(() => openOverlay('#academic-routine-edit-modal'));
          }}
          type="button"
          disabled={!schoolClass || isWeeklyHolidayDay}
          title={isWeeklyHolidayDay ? `Break for Holiday: ${weeklyHolidayTitle}` : ''}
        >
          <LuPlus className="size-4" /> Add Routine
        </button>
      </div>

      {selectedClass ? (
        <div className="px-5 pt-4 text-sm text-default-600">
          Showing routine for <span className="font-semibold text-default-800">{selectedClass.name}</span>
          {section ? <span className="text-default-500"> ({section})</span> : null}
        </div>
      ) : null}

      {!authStorage.getAccess() ? (
        <div className="px-5 py-4 text-sm text-default-600">
          Please sign in from <Link className="text-primary underline" to="/portal">Portal</Link> to load routines from backend.
        </div>
      ) : null}

      {flash ? (
        <div className="px-5 pt-4">
          <div className="relative rounded-md border border-primary/20 bg-primary/10 px-4 py-3 pr-11 text-sm text-default-800">
            {flash}
            <button
              type="button"
              onClick={() => setFlash('')}
              className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-default-700 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close message"
            >
              <span aria-hidden="true" className="text-base leading-none">
                Ã—
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="px-5 py-4 text-sm text-danger">{error}</div> : null}

      <div className="p-5">
        {!schoolClass ? <div className="text-sm text-default-500">Select a class to view routine.</div> : null}
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
                        <th className="px-3.5 py-3 text-start">START TIME</th>
                        <th className="px-3.5 py-3 text-start">END TIME</th>
                        <th className="px-3.5 py-3 text-start">IS BREAK</th>
                        <th className="px-3.5 py-3 text-start">CLASS ROOM</th>
                        <th className="px-3.5 py-3 text-start">ACTION</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-default-200">
                      {isLoading ? (
                        <tr className="text-default-800 font-normal whitespace-nowrap">
                          <td className="px-3.5 py-4 text-sm" colSpan={7}>
                            Loading...
                          </td>
                        </tr>
                      ) : isWeeklyHolidayDay ? (
                        <tr className="text-default-800 font-normal whitespace-nowrap">
                          <td className="px-3.5 py-4 text-sm" colSpan={7}>
                            <div className="rounded-md border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                              <div className="font-semibold">Break for Holiday: {weeklyHolidayTitle}</div>
                            </div>
                          </td>
                        </tr>
                      ) : !dayRows.length ? (
                        <tr className="text-default-800 font-normal whitespace-nowrap">
                          <td className="px-3.5 py-4 text-sm" colSpan={7}>
                            No routine for {dayTabs.find(d => d.value === activeDay)?.label || 'this day'}.
                          </td>
                        </tr>
                      ) : null}

                      {!isWeeklyHolidayDay
                        ? dayRows.map(rt => (
                            <tr key={rt.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                              <td className="px-3.5 py-3 text-sm">{rt.subject_label || '-'}</td>
                              <td className="px-3.5 py-3 text-sm">{rt.subject_teacher_label || '-'}</td>
                              <td className="px-3.5 py-3 text-sm">{fmtTime(rt.start_time) || '-'}</td>
                              <td className="px-3.5 py-3 text-sm">{fmtTime(rt.end_time) || '-'}</td>
                              <td className="px-3.5 py-3 text-sm">{rt.routine_type === 'BREAK' ? 'Yes' : 'No'}</td>
                              <td className="px-3.5 py-3 text-sm">{rt.room || '-'}</td>
                              <td className="px-3.5 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setEditing(rt);
                                      requestAnimationFrame(() => openOverlay('#academic-routine-edit-modal'));
                                    }}
                                    className="btn size-8 bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                                    aria-haspopup="dialog"
                                    aria-expanded="false"
                                    aria-controls="academic-routine-edit-modal"
                                  >
                                    <LuPencil className="size-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedRoutine(rt);
                                      requestAnimationFrame(() => openOverlay('#academic-routine-delete-modal'));
                                    }}
                                    className="btn size-8 bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                                    aria-haspopup="dialog"
                                    aria-expanded="false"
                                    aria-controls="academic-routine-delete-modal"
                                  >
                                    <LuTrash2 className="size-4" />
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
          </>
        ) : null}
      </div>

      <DeleteModal routine={selectedRoutine} onConfirm={async () => {
        if (!selectedRoutine?.id) return;
        await apiJson(`/academic-routines/${selectedRoutine.id}/`, { method: 'DELETE' });
        setSelectedRoutine(null);
        setFlash('Routine deleted successfully.');
        // Reload
        if (schoolClass) {
          const qs = new URLSearchParams();
          qs.set('class', schoolClass);
          if (section) qs.set('section', section);
          const data = await apiJson(`/academic-routines/?${qs.toString()}`);
          const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
          setItems(results);
        }
      }} />

      <AddAcademicRoutine
        routine={editing}
        schoolClass={schoolClass}
        section={section}
        defaultDayOfWeek={String(activeDay)}
        blockedDays={weeklyHolidayDays}
        blockedTitle={weeklyHolidayTitle}
        onSaved={async msg => {
          setFlash(msg || 'Saved successfully.');
          // Reload
          if (schoolClass) {
            const qs = new URLSearchParams();
            qs.set('class', schoolClass);
            if (section) qs.set('section', section);
            const data = await apiJson(`/academic-routines/?${qs.toString()}`);
            const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
            setItems(results);
          }
        }}
      />
    </div>
  );
};

export default ClassRoutineViewer;
