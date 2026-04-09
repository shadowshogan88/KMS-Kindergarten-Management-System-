import { LuX } from 'react-icons/lu';
import { closeOverlay } from '@/utils/overlay';

const closeDeleteOverlay = () => closeOverlay('#student-delete-modal');

const DeleteModal = ({ student, onConfirm }) => {
  return (
    <div
      id="student-delete-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none hs-overlay-open:pointer-events-auto"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="student-delete-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 md:w-sm m-3 mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card shadow-2xs border border-default-200 rounded-xl pointer-events-auto px-6 py-8 relative">
          <div className="absolute top-3 end-3">
            <button type="button" className="size-5 text-default-800" aria-label="Close" data-hs-overlay="#student-delete-modal" onClick={closeDeleteOverlay}>
              <span className="sr-only">Close</span>
              <LuX className="size-5" />
            </button>
          </div>

          <h3 id="student-delete-modal-label" className="font-semibold text-base text-default-800 text-center">
            Are you sure?
          </h3>
          <div className="mt-2 text-center text-default-500 text-sm font-normal">Delete student?</div>

          <div className="mt-5 flex gap-2 justify-center">
            <button data-hs-overlay="#student-delete-modal" className="btn text-danger bg-transparent hover:bg-danger/10" onClick={closeDeleteOverlay}>
              Cancel
            </button>
            <button
              className="bg-danger text-white btn border-0 btn-sm"
              onClick={async () => {
                await onConfirm?.();
                closeDeleteOverlay();
              }}
              disabled={!student}
            >
              Yes, Delete It!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
