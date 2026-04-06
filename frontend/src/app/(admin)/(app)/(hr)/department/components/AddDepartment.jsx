import { useEffect, useMemo, useState } from 'react';
import { LuX } from 'react-icons/lu';
import { closeOverlay } from '@/utils/overlay';

const closeDepartmentOverlay = () => closeOverlay('#department-edit-modal');

const emptyValues = {
  name: '',
  head: '',
  phone: '',
  email: '',
  employees: '',
};

const AddDepartment = ({ department, onCreated, onUpdated, onRefresh }) => {
  const isEdit = useMemo(() => Boolean(department?.id), [department?.id]);

  const [values, setValues] = useState(emptyValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (!department) {
      setValues(emptyValues);
      return;
    }
    setValues({
      name: department.name || '',
      head: department.head || '',
      phone: department.phone || '',
      email: department.email || '',
      employees: department.employees === 0 ? '0' : String(department.employees || ''),
    });
  }, [department]);

  const submit = async () => {
    setError('');
    if (!values.name.trim()) {
      setError('Department name is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: values.name.trim(),
        head: values.head.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        employees: values.employees === '' ? 0 : Number(values.employees),
      };
      if (isEdit) await onUpdated?.(department, payload);
      else await onCreated?.(payload);

      setValues(emptyValues);
      await onRefresh?.();
      closeDepartmentOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add department.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="department-edit-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="department-edit-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-lg sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="department-edit-modal-label" className="font-bold text-default-800 text-base">
              {isEdit ? 'Edit Department' : 'Add Department'}
            </h3>
            <div>
              <button type="button" className="size-5 text-default-800" aria-label="Close" data-hs-overlay="#department-edit-modal" onClick={closeDepartmentOverlay} disabled={isSubmitting}>
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
                <label htmlFor="department-name" className="inline-block mb-2 text-base font-medium">
                  Department Name
                </label>
                <input
                  type="text"
                  id="department-name"
                  className="form-input"
                  placeholder="Department Name"
                  value={values.name}
                  onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="lg:col-span-12">
                <label htmlFor="department-head" className="inline-block mb-2 text-base font-medium">
                  Head of Dep. Name
                </label>
                <input
                  type="text"
                  id="department-head"
                  placeholder="Head name"
                  className="form-input"
                  value={values.head}
                  onChange={e => setValues(v => ({ ...v, head: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="lg:col-span-12">
                <label htmlFor="department-phone" className="inline-block mb-2 text-base font-medium">
                  Phone Number
                </label>
                <input
                  type="text"
                  id="department-phone"
                  className="form-input"
                  placeholder="1234567890"
                  value={values.phone}
                  onChange={e => setValues(v => ({ ...v, phone: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="lg:col-span-12">
                <label htmlFor="department-email" className="inline-block mb-2 text-base font-medium">
                  Email
                </label>
                <input
                  type="email"
                  id="department-email"
                  placeholder="Enter Email"
                  className="form-input"
                  value={values.email}
                  onChange={e => setValues(v => ({ ...v, email: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="lg:col-span-12">
                <label htmlFor="department-employees" className="inline-block mb-2 text-base font-medium">
                  Total Employee
                </label>
                <input
                  type="number"
                  min={0}
                  id="department-employees"
                  placeholder="0"
                  className="form-input"
                  value={values.employees}
                  onChange={e => setValues(v => ({ ...v, employees: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-x-2 py-3 px-4">
            <button data-hs-overlay="#department-edit-modal" onClick={closeDepartmentOverlay} className="bg-transparent text-danger btn border-0 hover:bg-danger/10" aria-label="Close" disabled={isSubmitting}>
              Cancel
            </button>

            <button type="button" className="text-white btn bg-primary" onClick={submit} disabled={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Department'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddDepartment;
