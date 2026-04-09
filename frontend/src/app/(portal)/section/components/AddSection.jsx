import { useEffect, useMemo, useState } from 'react';
import { LuX } from 'react-icons/lu';
import { closeOverlay } from '@/utils/overlay';

const closeSectionOverlay = () => closeOverlay('#section-edit-modal');

const AddSection = ({ section, onCreated, onUpdated, onRefresh }) => {
  const isEdit = useMemo(() => Boolean(section?.id), [section?.id]);

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (isSubmitting) return;
    setError('');
    setName(section?.name || '');
    closeSectionOverlay();
  };

  useEffect(() => {
    setError('');
    if (!section) {
      setName('');
      return;
    }
    setName(section.name || '');
  }, [section]);

  const submit = async () => {
    setError('');
    if (!name.trim()) {
      setError('Section name is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
      };
      if (isEdit) await onUpdated?.(section, payload);
      else await onCreated?.(payload);

      await onRefresh?.();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save section.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="section-edit-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none hs-overlay-open:pointer-events-auto"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="section-edit-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-lg sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="section-edit-modal-label" className="font-bold text-default-800 text-base">
              {isEdit ? 'Edit Section' : 'Add Section'}
            </h3>
            <div>
              <button
                type="button"
                className="size-5 text-default-800"
                aria-label="Close"
                data-hs-overlay="#section-edit-modal"
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
                <label htmlFor="section-name" className="inline-block mb-2 text-base font-medium">
                  Section Name
                </label>
                <input
                  id="section-name"
                  className="form-input"
                  placeholder="e.g. A, B, C, Red"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-x-2 py-3 px-4">
            <button
              data-hs-overlay="#section-edit-modal"
              onClick={handleClose}
              className="bg-transparent text-danger btn border-0 hover:bg-danger/10"
              aria-label="Close"
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button type="button" className="text-white btn bg-primary" onClick={submit} disabled={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Section'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSection;
