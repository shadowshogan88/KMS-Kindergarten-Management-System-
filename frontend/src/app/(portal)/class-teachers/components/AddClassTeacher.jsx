import { useEffect, useMemo, useState } from 'react';
import { LuX } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { closeOverlay } from '@/utils/overlay';

const closeClassTeacherOverlay = () => closeOverlay('#class-teacher-edit-modal');

const emptyValues = {
  classroom: '',
  teacher: '',
};

const AddClassTeacher = ({ classTeacher, onCreated, onUpdated, onRefresh }) => {
  const isEdit = useMemo(() => Boolean(classTeacher?.id), [classTeacher?.id]);
  const [values, setValues] = useState(emptyValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [classOptions, setClassOptions] = useState([]);
  const [classError, setClassError] = useState('');
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  const [teacherOptions, setTeacherOptions] = useState([]);
  const [teacherError, setTeacherError] = useState('');
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');

  const handleClose = () => {
    if (isSubmitting) return;
    setError('');
    setTeacherOpen(false);
    if (!classTeacher) {
      setValues(emptyValues);
      setTeacherSearch('');
    } else {
      setValues({
        classroom: classTeacher.classroom_key || '',
        teacher: classTeacher.teacher ? String(classTeacher.teacher) : '',
      });
      setTeacherSearch(classTeacher.teacher_label || '');
    }
    closeClassTeacherOverlay();
  };

  useEffect(() => {
    setError('');
    if (!classTeacher) {
      setValues(emptyValues);
      setTeacherSearch('');
      return;
    }
    setValues({
      classroom: classTeacher.classroom_key || '',
      teacher: classTeacher.teacher ? String(classTeacher.teacher) : '',
    });
    setTeacherSearch(classTeacher.teacher_label || '');
  }, [classTeacher]);

  useEffect(() => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;

    let isMounted = true;
    setClassError('');
    setIsLoadingClasses(true);
    apiJson('/academic-classes/options/')
      .then(data => {
        if (!isMounted) return;
        setClassOptions(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        if (!isMounted) return;
        setClassError(e instanceof Error ? e.message : 'Failed to load class options.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingClasses(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;

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
        setTeacherError(e instanceof Error ? e.message : 'Failed to load teacher options.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingTeachers(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedTeacher = useMemo(() => {
    if (!values.teacher) return null;
    return teacherOptions.find(opt => String(opt.value) === String(values.teacher)) || null;
  }, [teacherOptions, values.teacher]);

  const teacherInputValue = teacherOpen ? teacherSearch : (selectedTeacher?.label || teacherSearch);

  const filteredTeachers = useMemo(() => {
    const q = (teacherSearch || '').trim().toLowerCase();
    const list = q
      ? teacherOptions.filter(opt => String(opt.label || '').toLowerCase().includes(q))
      : teacherOptions;
    return list.slice(0, 7);
  }, [teacherOptions, teacherSearch]);

  const submit = async () => {
    setError('');
    if (!values.classroom) {
      setError('Class is required.');
      return;
    }
    if (!values.teacher) {
      setError('Teacher is required.');
      return;
    }
    const teacherId = Number(values.teacher);
    if (!Number.isFinite(teacherId) || teacherId <= 0) {
      setError('Please select a teacher from the list.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        classroom: values.classroom,
        teacher: teacherId,
      };

      if (isEdit) await onUpdated?.(classTeacher, payload);
      else await onCreated?.(payload);

      await onRefresh?.();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save class teacher.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="class-teacher-edit-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none hs-overlay-open:pointer-events-auto"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="class-teacher-edit-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-lg sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="class-teacher-edit-modal-label" className="font-bold text-default-800 text-base">
              {isEdit ? 'Edit Class Teacher' : 'Add Class Teacher'}
            </h3>
            <div>
              <button
                type="button"
                className="size-5 text-default-800"
                aria-label="Close"
                data-hs-overlay="#class-teacher-edit-modal"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                <span className="sr-only">Close</span>
                <LuX className="size-5" />
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto pb-44">
            {error ? (
              <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-y-4">
              <div className="lg:col-span-12">
                <label htmlFor="class-teacher-classroom" className="inline-block mb-2 text-base font-medium">
                  Class
                </label>
                <select
                  id="class-teacher-classroom"
                  className="form-input"
                  value={values.classroom}
                  onChange={e => setValues(v => ({ ...v, classroom: e.target.value }))}
                  disabled={isSubmitting || isLoadingClasses}
                >
                  <option value="">{isLoadingClasses ? 'Loading classes...' : 'Select class'}</option>
                  {classOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {classError ? <div className="mt-2 text-xs text-danger">{classError}</div> : null}
              </div>

              <div className="lg:col-span-12">
                <label htmlFor="class-teacher-teacher" className="inline-block mb-2 text-base font-medium">
                  Teacher
                </label>
                <div className="relative">
                  <input
                    id="class-teacher-teacher"
                    className="form-input"
                    value={teacherInputValue}
                    placeholder={isLoadingTeachers ? 'Loading teachers...' : 'Search teacher'}
                    onFocus={() => {
                      if (isSubmitting || isLoadingTeachers) return;
                      setTeacherOpen(true);
                      setTeacherSearch('');
                    }}
                    onBlur={() => {
                      setTimeout(() => setTeacherOpen(false), 150);
                    }}
                    onChange={e => {
                      setTeacherOpen(true);
                      setTeacherSearch(e.target.value);
                      if (values.teacher) setValues(v => ({ ...v, teacher: '' }));
                    }}
                    disabled={isSubmitting || isLoadingTeachers}
                    autoComplete="off"
                  />

                  {teacherOpen ? (
                    <div className="absolute z-[999] mt-1 w-full rounded-md border border-default-200 bg-card shadow-sm max-h-60 overflow-auto">
                      {filteredTeachers.length ? (
                        filteredTeachers.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-default-800 hover:bg-default-150"
                            onMouseDown={e => {
                              e.preventDefault();
                              setValues(v => ({ ...v, teacher: String(opt.value) }));
                              setTeacherSearch(opt.label || '');
                              setTeacherOpen(false);
                            }}
                          >
                            {opt.label}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-default-500">
                          {teacherSearch ? 'No teachers found.' : 'Type to search teachers.'}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                {teacherError ? <div className="mt-2 text-xs text-danger">{teacherError}</div> : null}
              </div>
            </div>
          </div>

          <div className="card-footer flex justify-end gap-2">
            <button
              type="button"
              className="btn bg-default-100 text-default-800"
              data-hs-overlay="#class-teacher-edit-modal"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn bg-primary text-white"
              onClick={submit}
              disabled={isSubmitting}
            >
              {isEdit ? 'Save Changes' : 'Add Class Teacher'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddClassTeacher;
