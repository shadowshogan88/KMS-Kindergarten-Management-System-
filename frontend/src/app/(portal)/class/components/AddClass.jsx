import { useEffect, useMemo, useState } from 'react';
import { LuX } from 'react-icons/lu';
import { closeOverlay } from '@/utils/overlay';
import { apiJson } from '@/utils/api';

const FALLBACK_SECTIONS = ['A', 'B', 'C', 'D', 'E'];

const closeClassOverlay = () => closeOverlay('#class-edit-modal');

const AddClass = ({ schoolClass, onCreated, onUpdated, onRefresh }) => {
  const isEdit = useMemo(() => Boolean(schoolClass?.id), [schoolClass?.id]);
  const [name, setName] = useState('');
  const [sections, setSections] = useState([]);
  const [availableSections, setAvailableSections] = useState(FALLBACK_SECTIONS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    apiJson('/sections/')
      .then(data => {
        const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        const names = rows.map(r => r?.name).filter(Boolean);
        if (!isMounted) return;
        if (names.length) setAvailableSections(names);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setError('');
    if (!schoolClass) {
      setName('');
      setSections([]);
      return;
    }
    setName(schoolClass.name || '');
    setSections(Array.isArray(schoolClass.sections) ? schoolClass.sections : []);
  }, [schoolClass]);

  const toggleSection = section => {
    setSections(prev => (prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]));
  };

  const displaySection = section => String(section || '').replace(/^section\s+/i, '').trim();

  const submit = async () => {
    setError('');
    if (!name.trim()) {
      setError('Class name is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        sections,
      };
      if (isEdit) await onUpdated?.(schoolClass, payload);
      else await onCreated?.(payload);

      setName('');
      setSections([]);
      await onRefresh?.();
      closeClassOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add class.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="class-edit-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="class-edit-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-lg sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="class-edit-modal-label" className="font-bold text-default-800 text-base">
              {isEdit ? 'Edit Class' : 'Add Class'}
            </h3>
            <div>
              <button type="button" className="size-5 text-default-800" aria-label="Close" data-hs-overlay="#class-edit-modal" disabled={isSubmitting}>
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
                <label htmlFor="class-name" className="inline-block mb-2 text-base font-medium">
                  Class Name
                </label>
                <input
                  type="text"
                  id="class-name"
                  className="form-input"
                  placeholder="Class name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="lg:col-span-12">
                <div className="inline-block mb-2 text-base font-medium">Section</div>
                <div className="flex flex-wrap gap-3">
                  {availableSections.map(section => (
                    <label key={section} className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="form-checkbox rounded-full"
                        checked={sections.includes(section)}
                        onChange={() => toggleSection(section)}
                        disabled={isSubmitting}
                      />
                      <span className="text-sm font-medium text-default-800">{displaySection(section)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-x-2 py-3 px-4">
            <button data-hs-overlay="#class-edit-modal" className="bg-transparent text-danger btn border-0 hover:bg-danger/10" aria-label="Close" disabled={isSubmitting}>
              Cancel
            </button>

            <button type="button" className="text-white btn bg-primary" onClick={submit} disabled={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Class'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddClass;
