import { useEffect, useMemo, useState } from 'react';
import { LuX } from 'react-icons/lu';
import { closeOverlay } from '@/utils/overlay';

const closeTeacherOverlay = () => closeOverlay('#subject-teacher-edit-modal');

const emptyValues = {
  name: '',
  phone: '',
  teacher_code: '',
  create_user: false,
  username: '',
  password: '',
  email: '',
};

const AddSubjectTeacher = ({ subjectTeacher, onCreated, onUpdated, onRefresh }) => {
  const isEdit = useMemo(() => Boolean(subjectTeacher?.id), [subjectTeacher?.id]);
  const [values, setValues] = useState(emptyValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdCreds, setCreatedCreds] = useState(null);

  useEffect(() => {
    setError('');
    setCreatedCreds(null);
    if (!subjectTeacher) {
      setValues(emptyValues);
      return;
    }
    setValues({
      name: subjectTeacher.name || '',
      phone: subjectTeacher.phone || '',
      teacher_code: subjectTeacher.teacher_code || '',
      create_user: false,
      username: '',
      password: '',
      email: '',
    });
  }, [subjectTeacher]);

  const submit = async () => {
    setError('');
    setCreatedCreds(null);
    if (!values.name.trim()) {
      setError('Teacher name is required.');
      return;
    }
    const code = values.teacher_code.trim().toUpperCase();
    if (code && code.length !== 4) {
      setError('Teacher code must be 4 characters (or leave empty for auto-generate).');
      return;
    }
    if (!isEdit && values.create_user) {
      const email = values.email.trim();
      if (!email) {
        setError('Email is required for teacher login.');
        return;
      }
      const username = values.username.trim();
      if (username && username.length < 3) {
        setError('Username must be at least 3 characters (or leave empty for auto-generate).');
        return;
      }
      const password = values.password.trim();
      if (password && password.length < 6) {
        setError('Password must be at least 6 characters (or leave empty for auto-generate).');
        return;
      }
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

      if (isEdit) {
        await onUpdated?.(subjectTeacher, payload);
      } else {
        if (values.create_user) {
          payload.create_user = true;
          const username = values.username.trim();
          const password = values.password.trim();
          const email = values.email.trim();
          payload.email = email;
          if (username) payload.username = username;
          if (password) payload.password = password;
        }
        const created = await onCreated?.(payload);
        const genUser = created?.generated_username || '';
        const genPass = created?.generated_password || '';
        if (genUser && genPass) {
          setCreatedCreds({ username: genUser, password: genPass });
          await onRefresh?.();
          return; // keep modal open so user can copy credentials
        }
      }

      await onRefresh?.();
      closeTeacherOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save subject teacher.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyText = async text => {
    try {
      await navigator?.clipboard?.writeText?.(text);
    } catch {}
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

            {createdCreds ? (
              <div className="mb-4 rounded-md border border-success/20 bg-success/10 px-4 py-3 text-sm text-default-800">
                <div className="font-semibold text-success">Teacher login created</div>
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      Username: <span className="font-semibold">{createdCreds.username}</span>
                    </div>
                    <button type="button" className="text-primary underline text-sm" onClick={() => copyText(createdCreds.username)}>
                      Copy
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      Password: <span className="font-semibold">{createdCreds.password}</span>
                    </div>
                    <button type="button" className="text-primary underline text-sm" onClick={() => copyText(createdCreds.password)}>
                      Copy
                    </button>
                  </div>
                  <div className="text-xs text-default-600">Please save these credentials now. For security, they will not be shown again.</div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-y-4">
              {isEdit && subjectTeacher?.user_label ? (
                <div className="rounded-md border border-default-200 bg-default-50 px-4 py-3 text-sm text-default-700">
                  Linked user: <span className="font-semibold text-default-800">{subjectTeacher.user_label}</span>
                </div>
              ) : null}

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

              {!isEdit ? (
                <div className="lg:col-span-12">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      className="form-checkbox rounded"
                      type="checkbox"
                      checked={Boolean(values.create_user)}
                      onChange={e => setValues(v => ({ ...v, create_user: e.target.checked }))}
                      disabled={isSubmitting || Boolean(createdCreds)}
                    />
                    <span className="text-sm font-medium text-default-800">Create teacher username & password (login)</span>
                  </label>
                  <div className="mt-1 text-xs text-default-500">Optional: you can set username/password, or leave empty for auto-generate.</div>
                </div>
              ) : null}

              {!isEdit && values.create_user ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="teacher-email" className="inline-block mb-2 text-base font-medium">
                      Email <span className="text-danger">*</span>
                    </label>
                    <input
                      type="email"
                      id="teacher-email"
                      className="form-input"
                      placeholder="e.g. teacher@gmail.com"
                      value={values.email}
                      onChange={e => setValues(v => ({ ...v, email: e.target.value }))}
                      disabled={isSubmitting || Boolean(createdCreds)}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label htmlFor="teacher-username" className="inline-block mb-2 text-base font-medium">
                      Username (Optional)
                    </label>
                    <input
                      type="text"
                      id="teacher-username"
                      className="form-input"
                      placeholder="e.g. teacher01"
                      value={values.username}
                      onChange={e => setValues(v => ({ ...v, username: e.target.value }))}
                      disabled={isSubmitting || Boolean(createdCreds)}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label htmlFor="teacher-password" className="inline-block mb-2 text-base font-medium">
                      Password (Optional)
                    </label>
                    <input
                      type="password"
                      id="teacher-password"
                      className="form-input"
                      placeholder="leave empty for auto"
                      value={values.password}
                      onChange={e => setValues(v => ({ ...v, password: e.target.value }))}
                      disabled={isSubmitting || Boolean(createdCreds)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              ) : null}
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
              {createdCreds ? 'Close' : 'Cancel'}
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
