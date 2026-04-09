import { useEffect, useMemo, useState } from 'react';
import { LuLink2, LuRotateCcw, LuX } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { closeOverlay } from '@/utils/overlay';

const closeMeetEditOverlay = () => closeOverlay('#meet-time-edit-modal');

const fmtTime = t => (t ? String(t).slice(0, 5) : '');

const dayLabel = v => {
  const n = Number(v);
  const map = {
    0: 'Saturday',
    1: 'Sunday',
    2: 'Monday',
    3: 'Tuesday',
    4: 'Wednesday',
    5: 'Thursday',
    6: 'Friday',
  };
  return map[n] || '-';
};

const EditMeetTimeModal = ({ routine, onSaved }) => {
  const isOpen = useMemo(() => Boolean(routine?.id), [routine?.id]);
  const [values, setValues] = useState({ start_time: '', end_time: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (!routine) return;
    setValues({
      start_time: fmtTime(routine.start_time),
      end_time: fmtTime(routine.end_time),
    });
  }, [routine]);

  const submit = async () => {
    setError('');
    if (!routine?.id) return;
    if (!values.start_time) {
      setError('Start time is required.');
      return;
    }
    if (!values.end_time) {
      setError('End time is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiJson(`/academic-routines/${routine.id}/update-meet/`, {
        method: 'POST',
        body: {
          start_time: values.start_time,
          end_time: values.end_time,
        },
      });
      await onSaved?.('Meeting time updated successfully.');
      closeMeetEditOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update meeting time.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const regenerate = async () => {
    setError('');
    if (!routine?.id) return;
    setIsSubmitting(true);
    try {
      await apiJson(`/academic-routines/${routine.id}/regenerate-meet/`, { method: 'POST' });
      await onSaved?.('Meet link regenerated successfully.');
      closeMeetEditOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate meet link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="meet-time-edit-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none hs-overlay-open:pointer-events-auto"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="meet-time-edit-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-lg sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="meet-time-edit-modal-label" className="font-bold text-default-800 text-base">
              Edit Meeting Time
            </h3>
            <div>
              <button
                type="button"
                className="size-5 text-default-800"
                aria-label="Close"
                data-hs-overlay="#meet-time-edit-modal"
                onClick={closeMeetEditOverlay}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="meet-day" className="inline-block mb-2 text-base font-medium">
                  Day
                </label>
                <input id="meet-day" className="form-input bg-default-100" value={dayLabel(routine?.day_of_week)} disabled />
              </div>
              <div>
                <label htmlFor="meet-start" className="inline-block mb-2 text-base font-medium">
                  Start
                </label>
                <input
                  id="meet-start"
                  type="time"
                  className="form-input"
                  value={values.start_time}
                  onChange={e => setValues(v => ({ ...v, start_time: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="meet-end" className="inline-block mb-2 text-base font-medium">
                  End
                </label>
                <input
                  id="meet-end"
                  type="time"
                  className="form-input"
                  value={values.end_time}
                  onChange={e => setValues(v => ({ ...v, end_time: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {isOpen && routine?.meet_link ? (
              <div className="mt-4 text-xs text-default-600">
                This will also update the connected Google Calendar event time (if available).
              </div>
            ) : null}
          </div>

          <div className="flex justify-between items-center gap-x-2 py-3 px-4">
            <div className="flex items-center gap-3">
              {isOpen && routine?.meet_link ? (
                <>
                  <a className="text-primary underline text-sm" href={routine.meet_link} target="_blank" rel="noreferrer">
                    <LuLink2 className="inline size-4" /> Open
                  </a>
                  <button type="button" className="text-primary underline text-sm" onClick={regenerate} disabled={isSubmitting}>
                    <LuRotateCcw className="inline size-4" /> Regenerate
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-x-2">
            <button
              data-hs-overlay="#meet-time-edit-modal"
              onClick={closeMeetEditOverlay}
              className="bg-transparent text-danger btn border-0 hover:bg-danger/10"
              aria-label="Close"
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button type="button" className="text-white btn bg-primary" onClick={submit} disabled={isSubmitting || !routine}>
              Save
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditMeetTimeModal;
