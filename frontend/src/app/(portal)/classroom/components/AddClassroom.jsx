import { useEffect, useMemo, useState } from 'react';
import { LuX } from 'react-icons/lu';

import { closeOverlay } from '@/utils/overlay';

const closeClassroomOverlay = () => closeOverlay('#classroom-edit-modal');

const emptyValues = {
  room_no: '',
  capacity: '',
};

const AddClassroom = ({ room, onCreated, onUpdated, onRefresh }) => {
  const isEdit = useMemo(() => Boolean(room?.id), [room?.id]);

  const [values, setValues] = useState(emptyValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (!room) {
      setValues(emptyValues);
      return;
    }
    setValues({
      room_no: room.room_no || '',
      capacity: room.capacity === 0 ? '0' : String(room.capacity || ''),
    });
  }, [room]);

  const submit = async () => {
    setError('');
    if (!values.room_no.trim()) {
      setError('Room No is required.');
      return;
    }
    if (values.capacity === '' || Number.isNaN(Number(values.capacity)) || Number(values.capacity) <= 0) {
      setError('Capacity must be a positive number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        room_no: values.room_no.trim(),
        capacity: Number(values.capacity),
      };
      if (isEdit) await onUpdated?.(room, payload);
      else await onCreated?.(payload);

      await onRefresh?.();
      closeClassroomOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save classroom.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="classroom-edit-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="classroom-edit-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-lg sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="classroom-edit-modal-label" className="font-bold text-default-800 text-base">
              {isEdit ? 'Edit Classroom' : 'Add Classroom'}
            </h3>
            <div>
              <button
                type="button"
                className="size-5 text-default-800"
                aria-label="Close"
                data-hs-overlay="#classroom-edit-modal"
                onClick={closeClassroomOverlay}
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
                <label htmlFor="room-no" className="inline-block mb-2 text-base font-medium">
                  Room No <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="room-no"
                  className="form-input"
                  placeholder="e.g. 101"
                  value={values.room_no}
                  onChange={e => setValues(v => ({ ...v, room_no: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              <div className="lg:col-span-12">
                <label htmlFor="capacity" className="inline-block mb-2 text-base font-medium">
                  Capacity <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  id="capacity"
                  className="form-input"
                  placeholder="e.g. 30"
                  value={values.capacity}
                  onChange={e => setValues(v => ({ ...v, capacity: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-x-2 py-3 px-4">
            <button
              data-hs-overlay="#classroom-edit-modal"
              onClick={closeClassroomOverlay}
              className="bg-transparent text-danger btn border-0 hover:bg-danger/10"
              aria-label="Close"
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button type="button" className="text-white btn bg-primary" onClick={submit} disabled={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Classroom'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddClassroom;

