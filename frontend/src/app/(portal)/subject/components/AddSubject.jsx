import { useEffect, useMemo, useState } from 'react';
import { LuX } from 'react-icons/lu';
import { closeOverlay } from '@/utils/overlay';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const closeSubjectOverlay = () => closeOverlay('#subject-edit-modal');
const TYPE_THEORY = 'THEORY';
const TYPE_PRACTICAL = 'PRACTICAL';

const emptyValues = {
  classroom: '',
  subject_teacher: '',
  name: '',
  code: '',
  subject_type: TYPE_THEORY,
};

const AddSubject = ({ subject, onCreated, onUpdated, onRefresh }) => {
  const isEdit = useMemo(() => Boolean(subject?.id), [subject?.id]);
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

  useEffect(() => {
    setError('');
    if (!subject) {
      setValues(emptyValues);
      setTeacherSearch('');
      return;
    }
    setValues({
      classroom: subject.classroom_key || '',
      subject_teacher: subject.subject_teacher ? String(subject.subject_teacher) : '',
      name: subject.name || '',
      code: subject.code || '',
      subject_type: subject.subject_type || TYPE_THEORY,
    });
    setTeacherSearch(subject.subject_teacher_label || '');
  }, [subject]);

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
    if (!values.subject_teacher) return null;
    return teacherOptions.find(opt => String(opt.value) === String(values.subject_teacher)) || null;
  }, [teacherOptions, values.subject_teacher]);

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
    if (!values.subject_teacher) {
      setError('Subject teacher is required.');
      return;
    }
    if (!values.name.trim()) {
      setError('Subject name is required.');
      return;
    }
    if (!values.code.trim()) {
      setError('Subject code is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        classroom: values.classroom,
        subject_teacher: Number(values.subject_teacher),
        name: values.name.trim(),
        code: values.code.trim(),
        subject_type: values.subject_type,
      };
      if (isEdit) await onUpdated?.(subject, payload);
      else await onCreated?.(payload);

      await onRefresh?.();
      closeSubjectOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save subject.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="subject-edit-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="subject-edit-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-lg sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="subject-edit-modal-label" className="font-bold text-default-800 text-base">
              {isEdit ? 'Edit Subject' : 'Add Subject'}
            </h3>
            <div>
              <button
                type="button"
                className="size-5 text-default-800"
                aria-label="Close"
                data-hs-overlay="#subject-edit-modal"
                onClick={closeSubjectOverlay}
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
                <label htmlFor="subject-classroom" className="inline-block mb-2 text-base font-medium">
                  Class
                </label>
                <select
                  id="subject-classroom"
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
                <label htmlFor="subject-teacher" className="inline-block mb-2 text-base font-medium">
                  Subject Teacher
                </label>
                <div className="relative">
                  <input
                    id="subject-teacher"
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

              <div className="lg:col-span-12">
                <label htmlFor="subject-name" className="inline-block mb-2 text-base font-medium">
                  Subject Name
                </label>
                <input
                  type="text"
                  id="subject-name"
                  className="form-input"
                  placeholder="Subject name"
                  value={values.name}
                  onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="lg:col-span-12">
                <label htmlFor="subject-code" className="inline-block mb-2 text-base font-medium">
                  Subject Code
                </label>
                <input
                  type="text"
                  id="subject-code"
                  className="form-input"
                  placeholder="e.g. ENG-101"
                  value={values.code}
                  onChange={e => setValues(v => ({ ...v, code: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="lg:col-span-12">
                <div className="inline-block mb-2 text-base font-medium">Subject Type</div>
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="subject-type"
                      className="form-checkbox rounded-full"
                      checked={values.subject_type === TYPE_THEORY}
                      onChange={() => setValues(v => ({ ...v, subject_type: TYPE_THEORY }))}
                      disabled={isSubmitting}
                    />
                    <span className="text-sm font-medium text-default-800">Theory</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="subject-type"
                      className="form-checkbox rounded-full"
                      checked={values.subject_type === TYPE_PRACTICAL}
                      onChange={() => setValues(v => ({ ...v, subject_type: TYPE_PRACTICAL }))}
                      disabled={isSubmitting}
                    />
                    <span className="text-sm font-medium text-default-800">Practical</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-x-2 py-3 px-4">
            <button
              data-hs-overlay="#subject-edit-modal"
              onClick={closeSubjectOverlay}
              className="bg-transparent text-danger btn border-0 hover:bg-danger/10"
              aria-label="Close"
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button type="button" className="text-white btn bg-primary" onClick={submit} disabled={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Subject'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSubject;
