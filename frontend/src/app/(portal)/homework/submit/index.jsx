import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router';
import { LuCamera, LuExpand, LuFileUp, LuPencilLine, LuRefreshCw, LuSave, LuSend, LuShrink, LuTrash2, LuX } from 'react-icons/lu';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import SubmissionAnnotationModal from '@/app/(portal)/homework/components/SubmissionAnnotationModal';
import { apiForm, apiJson } from '@/utils/api';
import { authStorage, getApiBaseUrl } from '@/utils/auth';
import { openOverlay } from '@/utils/overlay';

const resolveApiUrl = maybeRelative => {
  if (!maybeRelative) return '';
  const s = String(maybeRelative);
  if (/^https?:\/\//i.test(s) || s.startsWith('blob:')) return s;
  const base = getApiBaseUrl();
  if (s.startsWith('/')) return `${base}${s}`;
  return `${base}/${s}`;
};

const sortImages = images =>
  (Array.isArray(images) ? images : []).slice().sort((a, b) => Number(a.page_number || 0) - Number(b.page_number || 0));

const moveItem = (arr, from, to) => {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const buildPageInputs = ids => Object.fromEntries(ids.map((id, index) => [id, String(index + 1)]));

const formatDateTime = value => {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString();
};

const HomeworkSubmit = () => {
  const canUseApi = Boolean(authStorage.getAccess());
  const user = authStorage.getUser();
  const role = user?.role || '';
  const { homeworkId } = useParams();
  const location = useLocation();

  const [homework, setHomework] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [images, setImages] = useState([]);
  const [orderedIds, setOrderedIds] = useState([]);
  const [pageInputs, setPageInputs] = useState({});
  const [gradeLogs, setGradeLogs] = useState([]);

  const [activeImage, setActiveImage] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyImageId, setBusyImageId] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const isStudent = role === 'STUDENT';
  const canAnnotate = role === 'ADMIN' || role === 'TEACHER';
  const isAssignmentPath = location.pathname.includes('/portal/assignment/');
  const isAssignment = isAssignmentPath || String(homework?.homework_type || '').toUpperCase() === 'ASSIGNMENT';
  const noun = isAssignment ? 'Assignment' : 'Homework';
  const listRoute = isAssignment ? '/portal/assignment' : '/portal/homework';
  const reviewRoute = isAssignment ? '/portal/assignment/submissions' : '/portal/homework/submissions';

  const canEdit = useMemo(() => {
    if (!isStudent) return false;
    if (submission?.status === 'GRADED') return false;
    const due = homework?.due_date ? new Date(homework.due_date) : null;
    if (due && !Number.isNaN(due.getTime()) && Date.now() > due.getTime()) return false;
    return true;
  }, [homework?.due_date, isStudent, submission?.status]);

  const load = async ({ ensureSubmission = true } = {}) => {
    if (!canUseApi || !homeworkId) return;
    setIsLoading(true);
    setError('');
    setFlash('');
    try {
      const hw = await apiJson(`/homeworks/${encodeURIComponent(homeworkId)}/`);
      setHomework(hw);

      const subList = await apiJson(`/submissions/?homework=${encodeURIComponent(homeworkId)}`);
      const rows = Array.isArray(subList?.results) ? subList.results : Array.isArray(subList) ? subList : [];
      let sub = rows[0] || null;
      if (!sub && ensureSubmission && isStudent) {
        sub = await apiJson('/submissions/', { method: 'POST', body: { homework: Number(homeworkId) || homeworkId } });
      }
      if (sub?.id) {
        const [subFull, gradeData] = await Promise.all([
          apiJson(`/submissions/${sub.id}/`),
          apiJson(`/grades/?submission=${encodeURIComponent(sub.id)}`).catch(() => []),
        ]);
        setSubmission(subFull);
        const imgRows = sortImages(subFull.images);
        setImages(imgRows);
        const nextIds = imgRows.map(i => i.id);
        setOrderedIds(nextIds);
        setPageInputs(buildPageInputs(nextIds));
        const logRows = Array.isArray(gradeData?.results) ? gradeData.results : Array.isArray(gradeData) ? gradeData : [];
        setGradeLogs(logRows);
      } else {
        setSubmission(null);
        setImages([]);
        setOrderedIds([]);
        setPageInputs({});
        setGradeLogs([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submission.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeworkId]);

  const uploadFiles = async files => {
    if (!submission?.id || !files?.length) return;
    setError('');
    setFlash('');
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('submission', String(submission.id));
        formData.append('image', file);
        await apiForm('/submission-images/', { method: 'POST', formData });
      }
      setFlash('Upload completed.');
      await load({ ensureSubmission: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const uploadSubmissionPdf = async file => {
    if (!submission?.id || !file) return;
    setError('');
    setFlash('');
    setIsPdfUploading(true);
    try {
      const formData = new FormData();
      formData.append('submission_pdf', file);
      await apiForm(`/submissions/${submission.id}/`, { method: 'PATCH', formData });
      setFlash('PDF uploaded.');
      await load({ ensureSubmission: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF upload failed.');
    } finally {
      setIsPdfUploading(false);
    }
  };

  const onDragStart = (e, id) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
  };

  const saveOrderedIds = async nextOrderedIds => {
    if (!submission?.id || nextOrderedIds.length < 1) return;
    setIsSavingOrder(true);
    try {
      await apiJson('/submission-images/reorder/', {
        method: 'POST',
        body: { submission: submission.id, ordered_image_ids: nextOrderedIds },
      });
      setFlash('Page order updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reorder pages.');
      await load({ ensureSubmission: false });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const onDrop = async (e, id) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain');
    if (!fromId) return;
    const fromIdx = orderedIds.findIndex(x => String(x) === String(fromId));
    const toIdx = orderedIds.findIndex(x => String(x) === String(id));
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const nextOrderedIds = moveItem(orderedIds, fromIdx, toIdx);
    setOrderedIds(nextOrderedIds);
    setPageInputs(buildPageInputs(nextOrderedIds));
    setError('');
    setFlash('');
    await saveOrderedIds(nextOrderedIds);
  };

  const saveOrder = async () => {
    setError('');
    setFlash('');
    await saveOrderedIds(orderedIds);
    await load({ ensureSubmission: false });
  };

  const submitFinal = async () => {
    if (!submission?.id) return;
    setError('');
    setFlash('');
    setIsSubmitting(true);
    try {
      await apiJson(`/submissions/${submission.id}/submit/`, { method: 'POST' });
      setFlash('Submission submitted.');
      await load({ ensureSubmission: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAnnotate = img => {
    if (!canAnnotate) return;
    setActiveImage(img || null);
    openOverlay('#submission-annotate-modal');
  };

  const updateImagePageNumber = async img => {
    const raw = String(pageInputs[img.id] || '').trim();
    const nextPage = Number(raw);
    if (!Number.isInteger(nextPage) || nextPage < 1) {
      setError('Page number must be 1 or greater.');
      return;
    }
    setBusyImageId(img.id);
    setError('');
    setFlash('');
    try {
      await apiJson(`/submission-images/${img.id}/`, {
        method: 'PATCH',
        body: { page_number: nextPage },
      });
      setFlash('Page number updated.');
      await load({ ensureSubmission: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update page number.');
    } finally {
      setBusyImageId(null);
    }
  };

  const deleteImage = async img => {
    setBusyImageId(img.id);
    setError('');
    setFlash('');
    try {
      await apiJson(`/submission-images/${img.id}/`, { method: 'DELETE' });
      setFlash('Image deleted.');
      await load({ ensureSubmission: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete image.');
    } finally {
      setBusyImageId(null);
    }
  };

  if (!canUseApi) return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;

  return (
    <>
      <PageMeta title={`Submit ${noun}`} />
      <main>
        <PageBreadcrumb title={`Submit ${noun}`} subtitle="Educational" />

        <div className="card">
          <div className="card-header flex justify-between items-center">
            <div className="min-w-0">
              <h6 className="card-title truncate">{noun} #{homeworkId}</h6>
              <div className="text-xs text-default-600 truncate">{homework?.title || ''}</div>
            </div>
            <div className="flex gap-2">
              <Link className="btn btn-sm bg-default-200" to={listRoute}>
                Back
              </Link>
              <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); load(); }} disabled={isLoading || isUploading || isPdfUploading}>
                <LuRefreshCw className="inline size-4" /> Refresh
              </button>
            </div>
          </div>

          <div className="card-body">
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            {flash ? <div className="mb-3 text-sm text-success">{flash}</div> : null}
            {isLoading ? <div className="text-sm">Loading...</div> : null}

            {!isLoading && !isStudent ? (
              <div className="text-sm text-default-600">
                This page is intended for students. Teachers can review via{' '}
                <Link className="text-primary underline" to={reviewRoute}>
                  submissions
                </Link>
                .
              </div>
            ) : null}

            {!isLoading && isStudent && !submission?.id ? (
              <div className="text-sm text-default-600">No submission record found.</div>
            ) : null}

            {submission?.id ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-default-700">
                      Status: <span className="font-semibold">{submission.status}</span>
                      {submission.submitted_at ? (
                        <span className="text-default-600">
                          {' '}
                          · Submitted: {String(submission.submitted_at).slice(0, 19).replace('T', ' ')}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit ? (
                        <>
                          <label className="btn btn-sm bg-primary text-white">
                            <LuCamera className="inline size-4" /> Add photos
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              multiple
                              className="hidden"
                              disabled={isUploading}
                              onChange={e => uploadFiles(e.target.files)}
                            />
                          </label>
                          <label className="btn btn-sm bg-default-200 text-default-900">
                            <LuFileUp className="inline size-4" /> Add PDF
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              disabled={isPdfUploading}
                              onChange={e => uploadSubmissionPdf(e.target.files?.[0] || null)}
                            />
                          </label>
                          <button className="btn btn-sm bg-default-200" onClick={saveOrder} disabled={isSavingOrder || orderedIds.length < 2}>
                            <LuSave className="inline size-4" /> Save order
                          </button>
                          <button className="btn btn-sm bg-primary text-white" onClick={submitFinal} disabled={isSubmitting || orderedIds.length < 1}>
                            <LuSend className="inline size-4" /> Submit
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {isUploading ? <div className="mt-2 text-sm text-default-500">Uploading...</div> : null}
                  {isPdfUploading ? <div className="mt-2 text-sm text-default-500">PDF uploading...</div> : null}

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {orderedIds.map(id => {
                      const img = images.find(i => String(i.id) === String(id));
                      if (!img) return null;
                      const displayPageNumber = orderedIds.findIndex(x => String(x) === String(id)) + 1;
                      return (
                        <div
                          key={img.id}
                          className="rounded-lg border border-default-200 bg-white overflow-hidden"
                          draggable={canEdit}
                          onDragStart={e => onDragStart(e, img.id)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => onDrop(e, img.id)}
                        >
                          <div className="relative">
                            <img src={resolveApiUrl(img.image)} alt={`Page ${displayPageNumber}`} className="w-full aspect-[3/4] object-cover" />
                            <div className="absolute top-1 left-1 rounded bg-black/70 text-white text-xs px-2 py-0.5">
                              #{displayPageNumber}
                            </div>
                            <button
                              type="button"
                              className="absolute top-1 right-1 rounded bg-black/70 text-white p-1.5 hover:bg-black/85"
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setFullscreenImage(current => current?.id === img.id ? null : img);
                              }}
                              title={fullscreenImage?.id === img.id ? 'Close full screen' : 'Open full screen'}
                            >
                              {fullscreenImage?.id === img.id ? <LuX className="size-4" /> : <LuExpand className="size-4" />}
                            </button>
                          </div>
                          <div className="p-2 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {canEdit ? (
                                <>
                                  <label className="text-[11px] text-default-500">Page</label>
                                  <input
                                    type="number"
                                    min="1"
                                    className="form-input h-8 min-w-0 w-20 text-xs"
                                    value={pageInputs[img.id] ?? ''}
                                    disabled={busyImageId === img.id}
                                    onChange={e => setPageInputs(prev => ({ ...prev, [img.id]: e.target.value }))}
                                  />
                                  <button
                                    className="btn btn-xs bg-default-200 shrink-0"
                                    onClick={e => {
                                      e.preventDefault();
                                      updateImagePageNumber(img);
                                    }}
                                    disabled={busyImageId === img.id}
                                  >
                                    <LuSave className="inline size-3.5" /> Set
                                  </button>
                                </>
                              ) : (
                                <div className="text-[11px] text-default-500">Page #{displayPageNumber}</div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {canAnnotate ? (
                                <button className="btn btn-xs bg-default-200 shrink-0" onClick={e => { e.preventDefault(); openAnnotate(img); }}>
                                  <LuPencilLine className="inline size-4" /> Annotate
                                </button>
                              ) : null}
                              {canEdit ? (
                                <button
                                  className="btn btn-xs bg-danger text-white shrink-0"
                                  onClick={e => {
                                    e.preventDefault();
                                    deleteImage(img);
                                  }}
                                  disabled={busyImageId === img.id}
                                >
                                  <LuTrash2 className="inline size-3.5" /> Delete
                                </button>
                              ) : null}
                            </div>
                            {canEdit ? <div className="text-[11px] text-default-500 break-words">Drag to reorder and page number will update automatically.</div> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!orderedIds.length ? (
                    <div className="mt-3 text-sm text-default-600">
                      Add photos using the camera button above. You can upload multiple pages and reorder them.
                    </div>
                  ) : null}

                  {submission?.submission_pdf ? (
                    <div className="mt-4 rounded-xl border border-default-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-default-800">Submitted PDF</div>
                        <a className="text-xs text-primary underline" href={resolveApiUrl(submission.submission_pdf)} target="_blank" rel="noreferrer">
                          Open in new tab
                        </a>
                      </div>
                      <iframe
                        title="Submitted PDF"
                        src={resolveApiUrl(submission.submission_pdf)}
                        className="w-full h-[480px] rounded-md border border-default-200"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="lg:col-span-1">
                  <div className="rounded-2xl border border-sky-200 bg-linear-to-br from-sky-50 via-cyan-50 to-blue-50 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Assignment</div>
                        <div className="mt-1 text-base font-semibold text-default-900">{noun}</div>
                      </div>
                      {homework?.due_date ? (
                        <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm">
                          Due {String(homework.due_date).slice(0, 10)}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-xl bg-white/80 p-3 border border-white/70">
                      <div className="text-[11px] uppercase tracking-wide text-default-500">Description</div>
                      <div className="mt-1 text-sm text-default-800 whitespace-pre-wrap">
                        {homework?.description ? <span>{homework.description}</span> : <span className="text-default-500">No description.</span>}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white/75 p-3 border border-white/70">
                        <div className="text-[11px] uppercase tracking-wide text-default-500">Due Time</div>
                        <div className="mt-1 text-sm font-medium text-default-900">
                          {homework?.due_date ? String(homework.due_date).slice(0, 19).replace('T', ' ') : '-'}
                          {homework?.allow_late_submission ? ' (late allowed)' : ''}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white/75 p-3 border border-white/70">
                        <div className="text-[11px] uppercase tracking-wide text-default-500">Attachment</div>
                        <div className="mt-1 text-sm font-medium text-default-900">
                          {homework?.pdf_file ? (
                            <a className="text-sky-700 underline decoration-sky-300 underline-offset-2" href={resolveApiUrl(homework.pdf_file)} target="_blank" rel="noreferrer">
                              Open attachment
                            </a>
                          ) : (
                            '-'
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-sky-100 bg-white/70 px-3 py-2 text-xs text-default-600">
                      Tip: On mobile, “Add photos” opens the camera. You can select multiple shots before uploading.
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 via-teal-50 to-lime-50 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Evaluation</div>
                          <div className="mt-1 text-base font-semibold text-default-900">Teacher Grade</div>
                        </div>
                        <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                          {submission?.marks_display || 'Pending'}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <div className="rounded-xl bg-white/80 p-3 border border-white/70">
                          <div className="text-[11px] uppercase tracking-wide text-default-500">Feedback</div>
                          <div className="mt-1 text-sm text-default-800 whitespace-pre-wrap">
                            {submission?.teacher_feedback || 'No feedback yet.'}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white/75 p-3 border border-white/70">
                            <div className="text-[11px] uppercase tracking-wide text-default-500">Graded By</div>
                            <div className="mt-1 text-sm font-medium text-default-900">{submission?.latest_graded_by || '-'}</div>
                          </div>
                          <div className="rounded-xl bg-white/75 p-3 border border-white/70">
                            <div className="text-[11px] uppercase tracking-wide text-default-500">Graded At</div>
                            <div className="mt-1 text-sm font-medium text-default-900">{formatDateTime(submission?.latest_graded_at) || '-'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {canAnnotate ? (
        <SubmissionAnnotationModal
          image={activeImage}
          onSaved={payload => {
            const message = typeof payload === 'string' ? payload : payload?.message;
            if (message) setFlash(message);
          }}
        />
      ) : null}

      {fullscreenImage ? (
        <div className="fixed inset-0 z-[9999] bg-black/85 p-4 flex items-center justify-center">
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-white/10 text-white p-2 hover:bg-white/20"
            onClick={() => setFullscreenImage(null)}
            title="Close full screen"
          >
            <LuShrink className="size-5" />
          </button>
          <img
            src={resolveApiUrl(fullscreenImage.image)}
            alt={`Page ${fullscreenImage.page_number || ''}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      ) : null}
    </>
  );
};

export default HomeworkSubmit;
