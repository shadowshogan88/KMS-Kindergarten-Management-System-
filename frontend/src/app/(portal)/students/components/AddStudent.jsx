import { useEffect, useMemo, useState } from 'react';
import { LuX } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { closeOverlay } from '@/utils/overlay';

const closeStudentOverlay = () => closeOverlay('#student-edit-modal');

const emptyValues = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  school_class: '',
  section: '',
  create_user: false,
  username: '',
  password: '',
};

const AddStudent = ({ student, onCreated, onUpdated, onRefresh }) => {
  const isEdit = useMemo(() => Boolean(student?.id), [student?.id]);
  const [values, setValues] = useState(emptyValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdCreds, setCreatedCreds] = useState(null);

  const [classes, setClasses] = useState([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [classError, setClassError] = useState('');

  useEffect(() => {
    let mounted = true;
    setIsLoadingClasses(true);
    setClassError('');
    apiJson('/academic-classes/simple/')
      .then(data => {
        if (!mounted) return;
        setClasses(Array.isArray(data) ? data : []);
      })
      .catch(e => {
        if (!mounted) return;
        setClassError(e instanceof Error ? e.message : 'Failed to load classes.');
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoadingClasses(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedClass = useMemo(() => classes.find(c => String(c?.id) === String(values.school_class)) || null, [classes, values.school_class]);
  const sectionOptions = useMemo(() => (Array.isArray(selectedClass?.sections) ? selectedClass.sections : []), [selectedClass?.sections]);

  useEffect(() => {
    setError('');
    setCreatedCreds(null);

    if (!student) {
      setValues(emptyValues);
      return;
    }

    setValues({
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      email: student.email || student.user_email || '',
      phone: student.phone || '',
      school_class: student.school_class ? String(student.school_class) : '',
      section: student.section || '',
      create_user: false,
      username: '',
      password: '',
    });
  }, [student]);

  useEffect(() => {
    if (!selectedClass) return;
    if (!sectionOptions.length) {
      if (values.section) setValues(v => ({ ...v, section: '' }));
      return;
    }
    if (values.section && sectionOptions.includes(String(values.section).toUpperCase())) return;
    setValues(v => ({ ...v, section: sectionOptions[0] || '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass?.id, sectionOptions.join(',')]);

  const copyText = async text => {
    try {
      await navigator?.clipboard?.writeText?.(text);
    } catch {}
  };

  const submit = async () => {
    setError('');
    setCreatedCreds(null);

    if (!values.first_name.trim()) {
      setError('First name is required.');
      return;
    }

    if (!values.school_class) {
      setError('Class is required.');
      return;
    }

    if (sectionOptions.length && !values.section) {
      setError('Section is required.');
      return;
    }

    if (!isEdit && values.create_user) {
      const email = values.email.trim();
      if (!email) {
        setError('Email is required for student login.');
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
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        school_class: Number(values.school_class),
        section: sectionOptions.length ? String(values.section || '').trim().toUpperCase() : '',
      };

      if (!payload.last_name) delete payload.last_name;
      if (!payload.email) delete payload.email;
      if (!payload.phone) delete payload.phone;
      if (!payload.section) delete payload.section;

      if (isEdit) {
        await onUpdated?.(student, payload);
        await onRefresh?.();
        closeStudentOverlay();
        return;
      }

      if (values.create_user) {
        payload.create_user = true;
        payload.email = values.email.trim();
        const username = values.username.trim();
        const password = values.password.trim();
        if (username) payload.username = username;
        if (password) payload.password = password;
      }

      const created = await onCreated?.(payload);
      const genUser = created?.generated_username || '';
      const genPass = created?.generated_password || '';
      if (genUser && genPass) {
        setCreatedCreds({ username: genUser, password: genPass });
        await onRefresh?.();
        return;
      }

      await onRefresh?.();
      closeStudentOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save student.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="student-edit-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="student-edit-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-xl sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="student-edit-modal-label" className="font-bold text-default-800 text-base">
              {isEdit ? 'Edit Student' : 'Add Student'}
            </h3>
            <div>
              <button
                type="button"
                className="size-5 text-default-800"
                aria-label="Close"
                data-hs-overlay="#student-edit-modal"
                onClick={closeStudentOverlay}
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
                <div className="font-semibold text-success">Student login created</div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="student-first-name" className="inline-block mb-2 text-base font-medium">
                  First Name <span className="text-danger">*</span>
                </label>
                <input
                  id="student-first-name"
                  className="form-input"
                  value={values.first_name}
                  onChange={e => setValues(v => ({ ...v, first_name: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="student-last-name" className="inline-block mb-2 text-base font-medium">
                  Last Name
                </label>
                <input
                  id="student-last-name"
                  className="form-input"
                  value={values.last_name}
                  onChange={e => setValues(v => ({ ...v, last_name: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="student-class" className="inline-block mb-2 text-base font-medium">
                  Class <span className="text-danger">*</span>
                </label>
                <select
                  id="student-class"
                  className="form-input"
                  value={values.school_class}
                  onChange={e => setValues(v => ({ ...v, school_class: e.target.value, section: '' }))}
                  disabled={isSubmitting || isLoadingClasses}
                >
                  <option value="">{isLoadingClasses ? 'Loading classes...' : 'Select class'}</option>
                  {classes.map(c => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {classError ? <div className="mt-2 text-xs text-danger">{classError}</div> : null}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="student-section" className="inline-block mb-2 text-base font-medium">
                  Section {sectionOptions.length ? <span className="text-danger">*</span> : null}
                </label>
                <select
                  id="student-section"
                  className="form-input"
                  value={values.section}
                  onChange={e => setValues(v => ({ ...v, section: e.target.value }))}
                  disabled={isSubmitting || !values.school_class || sectionOptions.length === 0}
                >
                  <option value="">{sectionOptions.length ? 'Select section' : 'No sections'}</option>
                  {sectionOptions.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="student-email" className="inline-block mb-2 text-base font-medium">
                  Email {!isEdit && values.create_user ? <span className="text-danger">*</span> : null}
                </label>
                <input
                  id="student-email"
                  type="email"
                  className="form-input"
                  value={values.email}
                  onChange={e => setValues(v => ({ ...v, email: e.target.value }))}
                  disabled={isSubmitting || Boolean(createdCreds) || (isEdit && Boolean(student?.user))}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="student-phone" className="inline-block mb-2 text-base font-medium">
                  Phone Number
                </label>
                <input
                  id="student-phone"
                  className="form-input"
                  value={values.phone}
                  onChange={e => setValues(v => ({ ...v, phone: e.target.value }))}
                  disabled={isSubmitting || Boolean(createdCreds)}
                />
              </div>

              {!isEdit ? (
                <div className="sm:col-span-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      className="form-checkbox rounded"
                      type="checkbox"
                      checked={Boolean(values.create_user)}
                      onChange={e => setValues(v => ({ ...v, create_user: e.target.checked }))}
                      disabled={isSubmitting || Boolean(createdCreds)}
                    />
                    <span className="text-sm font-medium text-default-800">Create student username & password (login)</span>
                  </label>
                  <div className="mt-1 text-xs text-default-500">Username auto format: sid{String(new Date().getFullYear()).slice(-2)}xxxxx (5 digits). Email required if enabled.</div>
                </div>
              ) : null}

              {!isEdit && values.create_user ? (
                <>
                  <div>
                    <label htmlFor="student-username" className="inline-block mb-2 text-base font-medium">
                      Username (Optional)
                    </label>
                    <input
                      id="student-username"
                      className="form-input"
                      value={values.username}
                      onChange={e => setValues(v => ({ ...v, username: e.target.value }))}
                      disabled={isSubmitting || Boolean(createdCreds)}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label htmlFor="student-password" className="inline-block mb-2 text-base font-medium">
                      Password (Optional)
                    </label>
                    <input
                      id="student-password"
                      type="password"
                      className="form-input"
                      value={values.password}
                      onChange={e => setValues(v => ({ ...v, password: e.target.value }))}
                      disabled={isSubmitting || Boolean(createdCreds)}
                      autoComplete="new-password"
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end items-center gap-x-2 py-3 px-4">
            <button
              data-hs-overlay="#student-edit-modal"
              onClick={closeStudentOverlay}
              className="bg-transparent text-danger btn border-0 hover:bg-danger/10"
              aria-label="Close"
              disabled={isSubmitting}
            >
              {createdCreds ? 'Close' : 'Cancel'}
            </button>

            <button type="button" className="text-white btn bg-primary" onClick={submit} disabled={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Student'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddStudent;

