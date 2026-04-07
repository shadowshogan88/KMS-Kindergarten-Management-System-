import { useEffect, useState } from 'react';
import { LuLink2, LuRotateCcw, LuX } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { closeOverlay } from '@/utils/overlay';

const closeOverrideOverlay = () => closeOverlay('#live-override-modal');

const fmtTime = t => (t ? String(t).slice(0, 5) : '');

const LiveDateOverrideModal = ({ event, status, onSaved }) => {
  const [values, setValues] = useState({ start_time: '', end_time: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    if (!event) return;
    setValues({
      start_time: fmtTime(event.start_time),
      end_time: fmtTime(event.end_time),
    });
  }, [event]);

  const saveOverride = async () => {
    if (!event?.routine_id || !event?.date) return;
    await apiJson(`/academic-routines/${event.routine_id}/override/`, {
      method: 'POST',
      body: {
        date: event.date,
        start_time: values.start_time,
        end_time: values.end_time,
      },
    });
  };

  const generateOneOffMeet = async () => {
    if (!event?.routine_id || !event?.date) return;
    await apiJson(`/academic-routines/${event.routine_id}/override-generate-meet/`, {
      method: 'POST',
      body: { date: event.date },
    });
  };

  const resetAndRegenerate = async () => {
    if (!event?.routine_id || !event?.date) return;
    await apiJson(`/academic-routines/${event.routine_id}/override-reset-regenerate/`, {
      method: 'POST',
      body: { date: event.date },
    });
  };

  const submit = async ({ withMeet } = { withMeet: false }) => {
    setError('');
    if (!event?.routine_id || !event?.date) return;
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
      await saveOverride();
      if (withMeet) await generateOneOffMeet();
      await onSaved?.(withMeet ? 'Override saved and Meet link generated.' : 'Override saved for selected date.');
      closeOverrideOverlay();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save override.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canMeet = Boolean(status?.connected) && event?.routine_type !== 'BREAK' && event?.subject_type !== 'PRACTICAL';
  const hasMeet = Boolean(event?.meet_link);

  return (
    <div
      id="live-override-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="live-override-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-lg sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="live-override-modal-label" className="font-bold text-default-800 text-base">
              Edit Single Date
            </h3>
            <div>
              <button
                type="button"
                className="size-5 text-default-800"
                aria-label="Close"
                data-hs-overlay="#live-override-modal"
                onClick={closeOverrideOverlay}
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

            <div className="text-sm text-default-700">
              Date: <span className="font-semibold text-default-800">{event?.date || '-'}</span>
            </div>
            <div className="mt-1 text-sm text-default-700">
              Subject: <span className="font-semibold text-default-800">{event?.subject_label || '-'}</span>
            </div>
            <div className="mt-1 text-xs text-default-500">This change applies only to this date (weekly routine stays unchanged).</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label htmlFor="override-start" className="inline-block mb-2 text-base font-medium">
                  Start
                </label>
                <input
                  id="override-start"
                  type="time"
                  className="form-input"
                  value={values.start_time}
                  onChange={e => setValues(v => ({ ...v, start_time: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="override-end" className="inline-block mb-2 text-base font-medium">
                  End
                </label>
                <input
                  id="override-end"
                  type="time"
                  className="form-input"
                  value={values.end_time}
                  onChange={e => setValues(v => ({ ...v, end_time: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {event?.meet_link ? (
                  <a className="text-primary underline text-sm" href={event.meet_link} target="_blank" rel="noreferrer">
                    <LuLink2 className="inline size-4" /> Open Meet
                  </a>
                ) : (
                  <span className="text-default-500 text-sm">No Meet link for this date.</span>
                )}
              </div>
              <button
                type="button"
                className="text-primary underline text-sm"
                disabled={!canMeet || isSubmitting}
                onClick={async () => {
                  setError('');
                  setIsSubmitting(true);
                  try {
                    await resetAndRegenerate();
                    await onSaved?.('Override reset to routine time and Meet regenerated.');
                    closeOverrideOverlay();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Failed to regenerate.');
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
              >
                <LuRotateCcw className="inline size-4" /> Regenerate & Reset
              </button>
            </div>
          </div>

          <div className="flex justify-end items-center gap-x-2 py-3 px-4">
            <button
              data-hs-overlay="#live-override-modal"
              onClick={closeOverrideOverlay}
              className="bg-transparent text-danger btn border-0 hover:bg-danger/10"
              aria-label="Close"
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button type="button" className="btn bg-default-200 hover:bg-default-300 text-default-700" onClick={() => submit({ withMeet: false })} disabled={isSubmitting || !event}>
              Save
            </button>

            {!hasMeet ? (
              <button type="button" className="text-white btn bg-primary" onClick={() => submit({ withMeet: true })} disabled={isSubmitting || !event || !canMeet}>
                Save + Generate
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveDateOverrideModal;
