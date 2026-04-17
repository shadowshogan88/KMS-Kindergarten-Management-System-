import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router';
import { LuArrowDown, LuArrowUp, LuCamera, LuDownload, LuExpand, LuMessageSquare, LuPencilLine, LuRefreshCw, LuSave, LuSend, LuShrink, LuTrash2, LuX } from 'react-icons/lu';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import SubmissionAnnotationModal from '@/app/(portal)/homework/components/SubmissionAnnotationModal';
import { apiForm, apiJson } from '@/utils/api';
import { authStorage, getApiBaseUrl } from '@/utils/auth';
import { openOverlay } from '@/utils/overlay';

const ANNOTATE_MODAL_ID = '#submission-annotate-modal';

const parseFilename = cd => {
  if (!cd) return '';
  const m1 = String(cd).match(/filename\*=UTF-8''([^;]+)/i);
  if (m1?.[1]) return decodeURIComponent(m1[1].replace(/\"/g, ''));
  const m2 = String(cd).match(/filename=([^;]+)/i);
  if (m2?.[1]) return m2[1].trim().replace(/^\"|\"$/g, '');
  return '';
};

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

const normalizeOverlay = overlay => {
  const source = overlay && typeof overlay === 'object' ? overlay : {};
  const strokes = Array.isArray(source.strokes) ? source.strokes : [];
  return strokes
    .map(stroke => {
      const points = Array.isArray(stroke?.points) ? stroke.points : [];
      const cleaned = points
        .filter(point => Array.isArray(point) && point.length >= 2)
        .map(point => {
          const x = Math.max(0, Math.min(1, Number(point[0]) || 0));
          const y = Math.max(0, Math.min(1, Number(point[1]) || 0));
          return [x, y];
        });
      if (cleaned.length < 2) return null;
      const width = Math.max(1, Math.min(14, Number(stroke?.width) || 2));
      const color = String(stroke?.color || '#ef4444');
      return { points: cleaned, width, color };
    })
    .filter(Boolean);
};

const buildOverlayFromAnnotationData = data => {
  const source = data && typeof data === 'object' ? data : {};
  return {
    strokes: Array.isArray(source.strokes) ? source.strokes : [],
    notes: source.text ? [{ text: String(source.text) }] : [],
  };
};

const AnnotationOverlay = ({ overlay }) => {
  const strokes = normalizeOverlay(overlay);
  if (!strokes.length) return null;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {strokes.map((stroke, index) => (
        <polyline
          // eslint-disable-next-line react/no-array-index-key
          key={`${index}-${stroke.points.length}`}
          points={stroke.points.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
          fill="none"
          stroke={stroke.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={(stroke.width / 4).toFixed(2)}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
};

const HomeworkSubmissionDetail = () => {
  const canUseApi = Boolean(authStorage.getAccess());
  const token = authStorage.getAccess();
  const user = authStorage.getUser();
  const role = user?.role || '';
  const isStudent = role === 'STUDENT';
  const isTeacher = role === 'TEACHER' || role === 'ADMIN';
  const canAnnotate = isTeacher;

  const { submissionId } = useParams();
  const location = useLocation();
  const isAssignmentPath = location.pathname.includes('/portal/assignment/submissions/');
  const backRoute = isAssignmentPath ? '/portal/assignment/submissions' : '/portal/homework/submissions';

  const [submission, setSubmission] = useState(null);
  const [homework, setHomework] = useState(null);
  const [images, setImages] = useState([]);
  const [orderedIds, setOrderedIds] = useState([]);
  const [pageInputs, setPageInputs] = useState({});
  const [gradeLogs, setGradeLogs] = useState([]);

  const [activeImage, setActiveImage] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyImageId, setBusyImageId] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const canUploadPages = isStudent && submission?.status !== 'GRADED';
  const canReorder = canUploadPages || isTeacher;
  const canGrade = useMemo(() => isTeacher && submission?.id, [isTeacher, submission?.id]);
  const canDownloadAnswerSheetPdf = isTeacher || submission?.status === 'GRADED';

  const load = async ({ silent = false } = {}) => {
    if (!canUseApi || !submissionId) return;
    if (!silent) {
      setIsLoading(true);
      setError('');
      setFlash('');
    }
    try {
      const [submissionData, logData] = await Promise.all([
        apiJson(`/submissions/${encodeURIComponent(submissionId)}/`),
        isTeacher ? apiJson(`/grades/?submission=${encodeURIComponent(submissionId)}`).catch(() => []) : Promise.resolve([]),
      ]);

      const hwData = submissionData?.homework ? await apiJson(`/homeworks/${encodeURIComponent(submissionData.homework)}/`).catch(() => null) : null;
      const imgRows = sortImages(submissionData?.images);
      const nextIds = imgRows.map(i => i.id);
      const logRows = Array.isArray(logData?.results) ? logData.results : Array.isArray(logData) ? logData : [];

      setSubmission(submissionData);
      setHomework(hwData);
      setImages(imgRows);
      setOrderedIds(nextIds);
      setPageInputs(buildPageInputs(nextIds));
      setGradeLogs(logRows);
      setMarks(submissionData?.marks_display || (submissionData?.teacher_marks ?? ''));
      setFeedback(submissionData?.teacher_feedback ?? '');

      if (!imgRows.length) {
        setSelectedImageId(null);
        setSelectedImage(null);
      } else {
        const next = imgRows.find(img => String(img.id) === String(selectedImageId)) || imgRows[0];
        setSelectedImageId(next?.id || null);
        setSelectedImage(next || null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submission.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  useEffect(() => {
    if (!images.length) {
      setSelectedImage(null);
      return;
    }
    const next = images.find(img => String(img.id) === String(selectedImageId)) || images[0];
    setSelectedImage(next || null);
    if (next?.id && String(next.id) !== String(selectedImageId)) setSelectedImageId(next.id);
  }, [images, selectedImageId]);

  useEffect(() => {
    if (!fullscreenImage?.id) return;
    const refreshed = images.find(img => String(img.id) === String(fullscreenImage.id));
    if (refreshed) setFullscreenImage(refreshed);
  }, [images, fullscreenImage?.id]);

  const applyOptimisticAnnotation = payload => {
    const imageId = payload?.imageId;
    if (!imageId) return;
    const nextOverlay = buildOverlayFromAnnotationData(payload?.annotation_data);
    setImages(prev =>
      prev.map(img =>
        String(img.id) === String(imageId)
          ? {
              ...img,
              annotation_overlay: nextOverlay,
            }
          : img
      )
    );
    setFullscreenImage(prev =>
      prev && String(prev.id) === String(imageId)
        ? {
            ...prev,
            annotation_overlay: nextOverlay,
          }
        : prev
    );
  };

  const downloadPdf = async () => {
    if (!token || !submissionId) return;
    setError('');
    setFlash('');
    try {
      const res = await fetch(`${getApiBaseUrl()}/submissions/${encodeURIComponent(submissionId)}/export-pdf/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const filename = parseFilename(res.headers.get('Content-Disposition')) || `submission_${submissionId}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setFlash('PDF downloaded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download PDF.');
    }
  };

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
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
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
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reorder pages.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const onDragStart = (e, id) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
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

  const moveImage = async (index, direction) => {
    if (!images.length) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    const ordered = [...images];
    const [picked] = ordered.splice(index, 1);
    ordered.splice(nextIndex, 0, picked);
    const nextOrderedIds = ordered.map(img => img.id);
    setOrderedIds(nextOrderedIds);
    setPageInputs(buildPageInputs(nextOrderedIds));
    await saveOrderedIds(nextOrderedIds);
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
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update page number.');
    } finally {
      setBusyImageId(null);
    }
  };

  const deleteImage = async img => {
    if (!img?.id) return;
    setBusyImageId(img.id);
    setError('');
    setFlash('');
    try {
      await apiJson(`/submission-images/${img.id}/`, { method: 'DELETE' });
      setFlash('Image deleted.');
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete image.');
    } finally {
      setBusyImageId(null);
    }
  };

  const openAnnotate = img => {
    if (!canAnnotate) return;
    setActiveImage(img || null);
    setSelectedImageId(img?.id || null);
    requestAnimationFrame(() => openOverlay(ANNOTATE_MODAL_ID));
  };

  const grade = async () => {
    if (!canGrade) return;
    setError('');
    setFlash('');
    if (marks === '' || marks === null) {
      setError('Marks is required.');
      return;
    }
    setIsGrading(true);
    try {
      await apiJson(`/submissions/${submission.id}/grade/`, { method: 'POST', body: { marks, feedback } });
      setFlash('Grade saved.');
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to grade.');
    } finally {
      setIsGrading(false);
    }
  };

  const submitFinal = async () => {
    if (!submission?.id) return;
    setError('');
    setFlash('');
    setIsSubmitting(true);
    try {
      await apiJson(`/submissions/${submission.id}/submit/`, { method: 'POST' });
      setFlash('Submission submitted. Teachers/admin can review it now.');
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnnotationSaved = async message => {
    setFlash(message || 'Annotation saved.');
    await load({ silent: true });
  };

  if (!canUseApi) return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;

  return (
    <>
      <PageMeta title="Submission Detail" />
      <main>
        <PageBreadcrumb title="Submission Detail" subtitle="Educational" />

        <div className="card">
          <div className="card-header flex justify-between items-center">
            <div className="min-w-0">
              <h6 className="card-title truncate">Submission #{submissionId}</h6>
              <div className="text-xs text-default-600 truncate">{submission?.homework_title || ''}</div>
            </div>
            <div className="flex gap-2">
              <Link className="btn btn-sm bg-default-200" to={backRoute}>
                Back
              </Link>
              <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); load(); }} disabled={isLoading || isUploading}>
                <LuRefreshCw className="inline size-4" /> Refresh
              </button>
              {canDownloadAnswerSheetPdf ? (
                <button className="btn btn-sm bg-primary text-white" onClick={downloadPdf} disabled={!images.length}>
                  <LuDownload className="inline size-4" /> Download Answer Sheet PDF
                </button>
              ) : null}
            </div>
          </div>

          <div className="card-body">
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            {flash ? <div className="mb-3 text-sm text-success">{flash}</div> : null}
            {isLoading ? <div className="text-sm">Loading...</div> : null}

            {submission?.id ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-default-700">
                      Status:{' '}
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold tracking-wide ${
                          submission.status === 'DRAFT'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : submission.status === 'SUBMITTED'
                              ? 'bg-sky-100 text-sky-800 border border-sky-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {submission.status}
                      </span>
                      {submission.submitted_at ? (
                        <span className="text-default-600">
                          {' '}| Submitted: {String(submission.submitted_at).slice(0, 19).replace('T', ' ')}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {canUploadPages ? (
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
                      ) : null}
                      {isStudent && submission?.status === 'DRAFT' ? (
                        <button className="btn btn-sm bg-emerald-600 text-white" onClick={submitFinal} disabled={isSubmitting}>
                          <LuSend className="inline size-4" /> {isSubmitting ? 'Submitting...' : 'Submit'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isStudent && submission?.status === 'DRAFT' ? (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      This submission is still in draft. Teacher/admin will only see it after you press Submit.
                    </div>
                  ) : null}

                  {isUploading ? <div className="mt-2 text-sm text-default-500">Uploading...</div> : null}

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {orderedIds.map(id => {
                      const img = images.find(i => String(i.id) === String(id));
                      if (!img) return null;
                      const displayPageNumber = orderedIds.findIndex(x => String(x) === String(id)) + 1;
                      return (
                        <div
                          key={img.id}
                          className="rounded-lg border border-default-200 bg-white overflow-hidden"
                          draggable={canReorder}
                          onDragStart={e => onDragStart(e, img.id)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => onDrop(e, img.id)}
                        >
                          <div className="relative">
                            <img src={resolveApiUrl(img.image)} alt={`Page ${displayPageNumber}`} className="w-full aspect-[3/4] object-cover" />
                            <AnnotationOverlay overlay={img.annotation_overlay} />
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
                              {canReorder ? (
                                <>
                                  <label className="text-[11px] text-default-500">Page</label>
                                  <input
                                    type="number"
                                    min="1"
                                    className="form-input h-8 min-w-0 w-20 text-xs"
                                    value={pageInputs[img.id] ?? ''}
                                    disabled={busyImageId === img.id}
                                    onChange={e => setPageInputs(prev => ({ ...prev, [img.id]: e.target.value }))}
                                    onBlur={() => updateImagePageNumber(img)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        updateImagePageNumber(img);
                                      }
                                    }}
                                  />
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
                              {canReorder ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-xs bg-default-200 shrink-0"
                                    onClick={() => moveImage(orderedIds.findIndex(x => String(x) === String(id)), -1)}
                                    disabled={isSavingOrder || orderedIds.findIndex(x => String(x) === String(id)) === 0}
                                  >
                                    <LuArrowUp className="inline size-3.5" /> Up
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-xs bg-default-200 shrink-0"
                                    onClick={() => moveImage(orderedIds.findIndex(x => String(x) === String(id)), 1)}
                                    disabled={isSavingOrder || orderedIds.findIndex(x => String(x) === String(id)) === orderedIds.length - 1}
                                  >
                                    <LuArrowDown className="inline size-3.5" /> Down
                                  </button>
                                </>
                              ) : null}
                              {canUploadPages ? (
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
                            {canReorder ? <div className="text-[11px] text-default-500 break-words">Drag to reorder and page number will update automatically.</div> : null}
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
                        <a
                          className="text-xs text-primary underline"
                          href={resolveApiUrl(submission.submission_pdf)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in new tab
                        </a>
                      </div>
                      <iframe
                        title="Submitted PDF"
                        src={resolveApiUrl(submission.submission_pdf)}
                        className="w-full h-[520px] rounded-md border border-default-200"
                      />
                    </div>
                  ) : null}

                </div>

                <div className="lg:col-span-1">
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

                    {isTeacher ? (
                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <div>
                          <label className="inline-block mb-2 text-sm font-medium">Marks</label>
                          <input className="form-input w-full" value={marks} onChange={e => setMarks(e.target.value)} disabled={isGrading} placeholder="80/100" />
                          <div className="mt-2 text-xs text-default-500">
                            Instruction: `90/100` means `obtained marks / total marks`.
                          </div>
                        </div>
                        <div>
                          <label className="inline-block mb-2 text-sm font-medium">Feedback</label>
                          <textarea className="form-input w-full min-h-24" value={feedback} onChange={e => setFeedback(e.target.value)} disabled={isGrading} />
                        </div>
                        <button className="btn bg-primary text-white w-full" onClick={grade} disabled={isGrading || !canGrade}>
                          <LuSave className="inline size-4" /> Save grade
                        </button>
                      </div>
                    ) : (
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
                    )}
                  </div>

                  <div className="mt-3 rounded-2xl border border-sky-200 bg-linear-to-br from-sky-50 via-cyan-50 to-blue-50 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Assignment</div>
                        <div className="mt-1 text-base font-semibold text-default-900">Homework</div>
                      </div>
                      {homework?.due_date ? (
                        <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm">
                          Due {String(homework.due_date).slice(0, 10)}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-xl bg-white/80 p-3 border border-white/70">
                      <div className="text-[11px] uppercase tracking-wide text-default-500">Description</div>
                      <div className="mt-1 text-sm text-default-800 prose prose-sm max-w-none">
                        {homework?.description ? (
                          <div dangerouslySetInnerHTML={{ __html: homework.description }} />
                        ) : (
                          <span className="text-default-500">No description.</span>
                        )}
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
                      Tip: On mobile, "Add photos" opens the camera. You can select multiple shots before uploading.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {canAnnotate ? (
          <SubmissionAnnotationModal
            image={activeImage}
            onSaved={async payload => {
              applyOptimisticAnnotation(payload);
              const message = typeof payload === 'string' ? payload : payload?.message;
              if (message) setFlash(message);
              await load({ silent: true });
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
            <div className="relative max-w-full max-h-full">
              <img
                src={resolveApiUrl(fullscreenImage.image)}
                alt={`Page ${fullscreenImage.page_number || ''}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
              <AnnotationOverlay overlay={fullscreenImage.annotation_overlay} />
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
};

export default HomeworkSubmissionDetail;
