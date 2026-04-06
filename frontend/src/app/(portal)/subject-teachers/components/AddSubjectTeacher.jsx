import { useEffect, useMemo, useState } from 'react';
import { LuX } from 'react-icons/lu';
import { closeOverlay } from '@/utils/overlay';

const closeTeacherOverlay = () => closeOverlay('#subject-teacher-edit-modal');

const emptyValues = {
  name: '',
  phone: '',
  teacher_code: '',
};

const AddSubjectTeacher = ({ subjectTeacher, onCreated, onUpdated, onRefresh }) => {
  const isEdit = useMemo(() => Boolean(subjectTeacher?.id), [subjectTeacher?.id]);
  const [values, setValues] = useState(emptyValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (!subjectTeacher) {
      setValues(emptyValues);
      return;
    }
    setValues({
      name: subjectTeacher.name || '',
      phone: subjectTeacher.phone || '',
      teacher_code: subjectTeacher.teacher_code || '',
    });
  }, [subjectTeacher]);

  const submit = async () => {
    setError('');
    if (!values.name.trim()) {
      setError('Teacher name is required.');
      return;
    }
    const code = values.teacher_code.trim().toUpperCase();
    if (code && code.length !== 4) {
      setError('Teacher code must be 4 characters (or leave empty for auto-generate).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: values.name.trim(),
        phone: values.phone.trim(),
        teacher_code: code,
      };

      if (!payload.teacher_code) delete payload.teacher_code;
      if (!payload.phone) delete payload.phone;

      if (isEdit) await onUpdated?.(subjectTeacher, payload);
      else await onCreated?.(payload);

      await onRefresh?.();
      closeTeacherOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save subject teacher.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="subject-teacher-edit-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="subject-teacher-edit-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-lg sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="subject-teacher-edit-modal-label" className="font-bold text-default-800 text-base">
              {isEdit ? 'Edit Subject Teacher' : 'Add Subject Teacher'}
            </h3>
            <div>
              <button
                type="button"
                className="size-5 text-default-800"
                aria-label="Close"
                data-hs-overlay="#subject-teacher-edit-modal"
                onClick={closeTeacherOverlay}
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
                <label htmlFor="teacher-name" className="inline-block mb-2 text-base font-medium">
                  Teacher Name
                </label>
                <input
                  type="text"
                  id="teacher-name"
                  className="form-input"
                  placeholder="Teacher name"
                  value={values.name}
                  onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="lg:col-span-12">
                <label htmlFor="teacher-phone" className="inline-block mb-2 text-base font-medium">
                  Phone Number
                </label>
                <input
                  type="text"
                  id="teacher-phone"
                  className="form-input"
                  placeholder="e.g. 01XXXXXXXXX"
                  value={values.phone}
                  onChange={e => setValues(v => ({ ...v, phone: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="lg:col-span-12">
                <label htmlFor="teacher-code" className="inline-block mb-2 text-base font-medium">
                  Teacher Code (Optional)
                </label>
                <input
                  type="text"
                  id="teacher-code"
                  className="form-input"
                  placeholder="e.g. A1B2 (leave empty for auto)"
                  value={values.teacher_code}
                  onChange={e => setValues(v => ({ ...v, teacher_code: e.target.value }))}
                  disabled={isSubmitting}
                />
                <div className="mt-2 text-xs text-default-500">If you leave it empty, a unique 4-character code will be generated.</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-x-2 py-3 px-4">
            <button
              data-hs-overlay="#subject-teacher-edit-modal"
              onClick={closeTeacherOverlay}
              className="bg-transparent text-danger btn border-0 hover:bg-danger/10"
              aria-label="Close"
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button type="button" className="text-white btn bg-primary" onClick={submit} disabled={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Subject Teacher'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSubjectTeacher;

