import { useEffect, useMemo, useState } from 'react';
import { LuX } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { closeOverlay } from '@/utils/overlay';

const closeRoutineOverlay = () => closeOverlay('#academic-routine-edit-modal');

const TYPE_PERIOD = 'PERIOD';
const TYPE_BREAK = 'BREAK';

const emptyValues = {
  routine_type: TYPE_PERIOD,
  title: '',
  subject: '',
  subject_teacher: '',
  day_of_week: '1',
  start_time: '',
  end_time: '',
  room: '',
};

const fmtTime = t => (t ? String(t).slice(0, 5) : '');

const AddAcademicRoutine = ({ routine, schoolClass, section, defaultDayOfWeek = '1', onSaved }) => {
  const isEdit = useMemo(() => Boolean(routine?.id), [routine?.id]);
  const [values, setValues] = useState(emptyValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [subjectOptions, setSubjectOptions] = useState([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [subjectError, setSubjectError] = useState('');
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');

  const [teacherOptions, setTeacherOptions] = useState([]);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
  const [teacherError, setTeacherError] = useState('');
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherTouched, setTeacherTouched] = useState(false);

  useEffect(() => {
    setError('');
    setTeacherTouched(false);
    if (!routine) {
      setValues({ ...emptyValues, day_of_week: String(defaultDayOfWeek) });
      setSubjectSearch('');
      setTeacherSearch('');
      return;
    }

    setValues({
      routine_type: routine.routine_type || TYPE_PERIOD,
      title: routine.title || '',
      subject: routine.subject ? String(routine.subject) : '',
      subject_teacher: routine.subject_teacher ? String(routine.subject_teacher) : '',
      day_of_week: routine.day_of_week !== undefined && routine.day_of_week !== null ? String(routine.day_of_week) : '1',
      start_time: fmtTime(routine.start_time),
      end_time: fmtTime(routine.end_time),
      room: routine.room || '',
    });

    setSubjectSearch(routine.subject_label || '');
    setTeacherSearch(routine.subject_teacher_label || '');
  }, [routine, defaultDayOfWeek]);

  // Load teachers once (used for override).
  useEffect(() => {
    let isMounted = true;
    setTeacherError('');
    setIsLoadingTeachers(true);
    apiJson('/subject-teachers/options/')
      .then(data => {
        if (!isMounted) return;
        setTeacherOptions(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        if (!isMounted) return;
        setTeacherError(e instanceof Error ? e.message : 'Failed to load teachers.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingTeachers(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const loadSubjects = async q => {
    if (!schoolClass) return;
    setIsLoadingSubjects(true);
    setSubjectError('');
    try {
      const qs = new URLSearchParams();
      qs.set('class', String(schoolClass));
      if (section) qs.set('section', String(section));
      if (q) qs.set('q', q);
      const data = await apiJson(`/subjects/options/?${qs.toString()}`);
      setSubjectOptions(Array.isArray(data) ? data : []);
    } catch (e) {
      setSubjectError(e instanceof Error ? e.message : 'Failed to load subjects.');
    } finally {
      setIsLoadingSubjects(false);
    }
  };

  useEffect(() => {
    // Refresh subjects when class/section changes.
    setSubjectOptions([]);
    setSubjectSearch('');
    if (!schoolClass) return;
    loadSubjects('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolClass, section]);

  const selectedSubject = useMemo(() => {
    if (!values.subject) return null;
    return subjectOptions.find(opt => String(opt.value) === String(values.subject)) || null;
  }, [subjectOptions, values.subject]);

  const selectedTeacher = useMemo(() => {
    if (!values.subject_teacher) return null;
    return teacherOptions.find(opt => String(opt.value) === String(values.subject_teacher)) || null;
  }, [teacherOptions, values.subject_teacher]);

  const filteredSubjects = useMemo(() => {
    const q = (subjectSearch || '').trim().toLowerCase();
    const list = q
      ? subjectOptions.filter(opt => String(opt.label || '').toLowerCase().includes(q))
      : subjectOptions;
    return list.slice(0, 7);
  }, [subjectOptions, subjectSearch]);

  const filteredTeachers = useMemo(() => {
    const q = (teacherSearch || '').trim().toLowerCase();
    const list = q
      ? teacherOptions.filter(opt => String(opt.label || '').toLowerCase().includes(q))
      : teacherOptions;
    return list.slice(0, 7);
  }, [teacherOptions, teacherSearch]);

  const subjectInputValue = subjectOpen ? subjectSearch : (selectedSubject?.label || subjectSearch);
  const teacherInputValue = teacherOpen ? teacherSearch : (selectedTeacher?.label || teacherSearch);

  const setRoutineType = nextType => {
    setValues(v => ({
      ...v,
      routine_type: nextType,
      ...(nextType === TYPE_BREAK ? { subject: '', subject_teacher: '', title: v.title || '' } : { title: '' }),
    }));
    setTeacherTouched(false);
    setSubjectSearch('');
    setTeacherSearch('');
  };

  const submit = async () => {
    setError('');
    if (!schoolClass) {
      setError('Class is required.');
      return;
    }
    if (!values.day_of_week) {
      setError('Day is required.');
      return;
    }
    if (!values.start_time) {
      setError('Start time is required.');
      return;
    }
    if (!values.end_time) {
      setError('End time is required.');
      return;
    }
    if (values.routine_type === TYPE_BREAK) {
      if (!values.title.trim()) {
        setError('Break title is required (e.g. Tiffin).');
        return;
      }
    } else {
      if (!values.subject) {
        setError('Subject is required.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        school_class: Number(schoolClass),
        section: section || '',
        routine_type: values.routine_type,
        title: values.title.trim(),
        subject: values.subject ? Number(values.subject) : null,
        subject_teacher: values.subject_teacher ? Number(values.subject_teacher) : null,
        day_of_week: Number(values.day_of_week),
        start_time: values.start_time,
        end_time: values.end_time,
        room: values.room.trim(),
      };

      if (payload.routine_type === TYPE_BREAK) {
        delete payload.subject;
        delete payload.subject_teacher;
      } else {
        delete payload.title;
        if (!payload.subject_teacher) delete payload.subject_teacher;
      }
      if (!payload.room) delete payload.room;

      if (isEdit) {
        await apiJson(`/academic-routines/${routine.id}/`, { method: 'PATCH', body: payload });
        await onSaved?.('Routine updated successfully.');
      } else {
        await apiJson('/academic-routines/', { method: 'POST', body: payload });
        await onSaved?.('Routine added successfully.');
      }

      closeRoutineOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save routine.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="academic-routine-edit-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="academic-routine-edit-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-xl sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="academic-routine-edit-modal-label" className="font-bold text-default-800 text-base">
              {isEdit ? 'Edit Routine' : 'Add Routine'}
            </h3>
            <div>
              <button
                type="button"
                className="size-5 text-default-800"
                aria-label="Close"
                data-hs-overlay="#academic-routine-edit-modal"
                onClick={closeRoutineOverlay}
                disabled={isSubmitting}
              >
                <span className="sr-only">Close</span>
                <LuX className="size-5" />
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto">
            {error ? (
              <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-y-4">
              <div className="lg:col-span-12">
                <div className="inline-block mb-2 text-base font-medium">Routine Type</div>
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="routine-type"
                      className="form-checkbox rounded-full"
                      checked={values.routine_type === TYPE_PERIOD}
                      onChange={() => setRoutineType(TYPE_PERIOD)}
                      disabled={isSubmitting}
                    />
                    <span className="text-sm font-medium text-default-800">Period</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="routine-type"
                      className="form-checkbox rounded-full"
                      checked={values.routine_type === TYPE_BREAK}
                      onChange={() => setRoutineType(TYPE_BREAK)}
                      disabled={isSubmitting}
                    />
                    <span className="text-sm font-medium text-default-800">Break</span>
                  </label>
                </div>
              </div>

              {values.routine_type === TYPE_BREAK ? (
                <div className="lg:col-span-12">
                  <label htmlFor="routine-title" className="inline-block mb-2 text-base font-medium">
                    Break Title
                  </label>
                  <input
                    type="text"
                    id="routine-title"
                    className="form-input"
                    placeholder="e.g. Tiffin"
                    value={values.title}
                    onChange={e => setValues(v => ({ ...v, title: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
              ) : (
                <>
                  <div className="lg:col-span-12">
                    <label htmlFor="routine-subject" className="inline-block mb-2 text-base font-medium">
                      Subject
                    </label>
                    <div className="relative">
                      <input
                        id="routine-subject"
                        className="form-input"
                        value={subjectInputValue}
                        placeholder={isLoadingSubjects ? 'Loading subjects...' : 'Search subject'}
                        onFocus={() => {
                          if (isSubmitting || isLoadingSubjects) return;
                          setSubjectOpen(true);
                          setSubjectSearch('');
                        }}
                        onBlur={() => setTimeout(() => setSubjectOpen(false), 150)}
                        onChange={e => {
                          setSubjectOpen(true);
                          setSubjectSearch(e.target.value);
                          if (values.subject) setValues(v => ({ ...v, subject: '' }));
                          loadSubjects(e.target.value);
                        }}
                        disabled={isSubmitting || isLoadingSubjects || !schoolClass}
                        autoComplete="off"
                      />

                      {subjectOpen && !isLoadingSubjects ? (
                        <div className="absolute z-50 mt-1 w-full rounded-md border border-default-200 bg-card shadow-sm max-h-60 overflow-auto">
                          {filteredSubjects.length ? (
                            filteredSubjects.map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm text-default-800 hover:bg-default-150"
                                onClick={() => {
                                  setValues(v => ({ ...v, subject: String(opt.value) }));
                                  setSubjectSearch('');
                                  setSubjectOpen(false);

                                  if (!teacherTouched && opt.subject_teacher) {
                                    setValues(v => ({ ...v, subject_teacher: String(opt.subject_teacher) }));
                                  }
                                }}
                              >
                                {opt.label}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-default-500">No subjects found.</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                    {subjectError ? <div className="mt-2 text-xs text-danger">{subjectError}</div> : null}
                  </div>

                  <div className="lg:col-span-12">
                    <label htmlFor="routine-teacher" className="inline-block mb-2 text-base font-medium">
                      Teacher (Auto from Subject)
                    </label>
                    <div className="relative">
                      <input
                        id="routine-teacher"
                        className="form-input"
                        value={teacherInputValue}
                        placeholder={isLoadingTeachers ? 'Loading teachers...' : 'Search teacher'}
                        onFocus={() => {
                          if (isSubmitting || isLoadingTeachers) return;
                          setTeacherOpen(true);
                          setTeacherSearch('');
                        }}
                        onBlur={() => setTimeout(() => setTeacherOpen(false), 150)}
                        onChange={e => {
                          setTeacherTouched(true);
                          setTeacherOpen(true);
                          setTeacherSearch(e.target.value);
                          if (values.subject_teacher) setValues(v => ({ ...v, subject_teacher: '' }));
                        }}
                        disabled={isSubmitting || isLoadingTeachers}
                        autoComplete="off"
                      />

                      {teacherOpen && !isLoadingTeachers ? (
                        <div className="absolute z-50 mt-1 w-full rounded-md border border-default-200 bg-card shadow-sm max-h-60 overflow-auto">
                          {filteredTeachers.length ? (
                            filteredTeachers.map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm text-default-800 hover:bg-default-150"
                                onClick={() => {
                                  setTeacherTouched(true);
                                  setValues(v => ({ ...v, subject_teacher: String(opt.value) }));
                                  setTeacherSearch('');
                                  setTeacherOpen(false);
                                }}
                              >
                                {opt.label}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-default-500">No teachers found.</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                    {teacherError ? <div className="mt-2 text-xs text-danger">{teacherError}</div> : null}
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="routine-day" className="inline-block mb-2 text-base font-medium">
                    Day
                  </label>
                  <select
                    id="routine-day"
                    className="form-input"
                    value={values.day_of_week}
                    onChange={e => setValues(v => ({ ...v, day_of_week: e.target.value }))}
                    disabled={isSubmitting}
                  >
                    <option value="0">Saturday</option>
                    <option value="1">Sunday</option>
                    <option value="2">Monday</option>
                    <option value="3">Tuesday</option>
                    <option value="4">Wednesday</option>
                    <option value="5">Thursday</option>
                    <option value="6">Friday</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="routine-start" className="inline-block mb-2 text-base font-medium">
                    Start
                  </label>
                  <input
                    id="routine-start"
                    type="time"
                    className="form-input"
                    value={values.start_time}
                    onChange={e => setValues(v => ({ ...v, start_time: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label htmlFor="routine-end" className="inline-block mb-2 text-base font-medium">
                    End
                  </label>
                  <input
                    id="routine-end"
                    type="time"
                    className="form-input"
                    value={values.end_time}
                    onChange={e => setValues(v => ({ ...v, end_time: e.target.value }))}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="lg:col-span-12">
                <label htmlFor="routine-room" className="inline-block mb-2 text-base font-medium">
                  Room (Optional)
                </label>
                <input
                  type="text"
                  id="routine-room"
                  className="form-input"
                  placeholder="e.g. 101"
                  value={values.room}
                  onChange={e => setValues(v => ({ ...v, room: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-x-2 py-3 px-4">
            <button
              data-hs-overlay="#academic-routine-edit-modal"
              onClick={closeRoutineOverlay}
              className="bg-transparent text-danger btn border-0 hover:bg-danger/10"
              aria-label="Close"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="button" className="text-white btn bg-primary" onClick={submit} disabled={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Routine'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddAcademicRoutine;
