import { useEffect, useMemo, useState } from 'react';
import { LuX } from 'react-icons/lu';

import { closeOverlay } from '@/utils/overlay';

const closeDesignationOverlay = () => closeOverlay('#designation-edit-modal');

const emptyValues = {
  title: '',
};

const AddDesignation = ({ designation, onCreated, onUpdated, onRefresh }) => {
  const isEdit = useMemo(() => Boolean(designation?.id), [designation?.id]);
  const [values, setValues] = useState(emptyValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (isSubmitting) return;
    setError('');
    if (!designation) setValues(emptyValues);
    else setValues({ title: designation.title || '' });
    closeDesignationOverlay();
  };

  useEffect(() => {
    setError('');
    if (!designation) {
      setValues(emptyValues);
      return;
    }
    setValues({
      title: designation.title || '',
    });
  }, [designation]);

  const submit = async () => {
    setError('');
    if (!values.title.trim()) {
      setError('Designation Title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: values.title.trim(),
      };
      if (isEdit) await onUpdated?.(designation, payload);
      else await onCreated?.(payload);

      await onRefresh?.();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save designation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="designation-edit-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none hs-overlay-open:pointer-events-auto"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="designation-edit-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-lg sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="designation-edit-modal-label" className="font-bold text-default-800 text-base">
              {isEdit ? 'Edit Designation' : 'Add Designation'}
            </h3>
            <div>
              <button
                type="button"
                className="size-5 text-default-800"
                aria-label="Close"
                data-hs-overlay="#designation-edit-modal"
                onClick={handleClose}
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
                <label htmlFor="designation-title" className="inline-block mb-2 text-base font-medium">
                  Designation Title <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="designation-title"
                  className="form-input"
                  placeholder="Designation Title"
                  value={values.title}
                  onChange={e => setValues(v => ({ ...v, title: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-x-2 py-3 px-4">
            <button
              data-hs-overlay="#designation-edit-modal"
              onClick={handleClose}
              className="bg-transparent text-danger btn border-0 hover:bg-danger/10"
              aria-label="Close"
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button type="button" className="text-white btn bg-primary" onClick={submit} disabled={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Designation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddDesignation;
