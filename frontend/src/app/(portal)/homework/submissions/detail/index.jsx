import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { LuArrowDown, LuArrowUp, LuDownload, LuMessageSquare, LuRefreshCw, LuSave } from 'react-icons/lu';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import SubmissionAnnotationModal from '@/app/(portal)/homework/components/SubmissionAnnotationModal';
import { apiJson } from '@/utils/api';
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

const HomeworkSubmissionDetail = () => {
  const canUseApi = Boolean(authStorage.getAccess());
  const token = authStorage.getAccess();
  const user = authStorage.getUser();
  const role = user?.role || '';
  const isTeacher = role === 'TEACHER' || role === 'ADMIN';
  const canReorder = role === 'ADMIN' || role === 'TEACHER' || role === 'STUDENT';
  const canAnnotate = isTeacher;

  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [annotationImage, setAnnotationImage] = useState(null);
  const [gradeLogs, setGradeLogs] = useState([]);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const images = useMemo(() => {
    const rows = Array.isArray(submission?.images) ? [...submission.images] : [];
    rows.sort((a, b) => Number(a.page_number || 0) - Number(b.page_number || 0));
    return rows;
  }, [submission?.images]);

  const canGrade = useMemo(() => isTeacher && submission?.id, [isTeacher, submission?.id]);

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

      setSubmission(submissionData);
      setMarks(submissionData?.marks_display || (submissionData?.teacher_marks ?? ''));
      setFeedback(submissionData?.teacher_feedback ?? '');

      const logRows = Array.isArray(logData?.results) ? logData.results : Array.isArray(logData) ? logData : [];
      setGradeLogs(logRows);

      const incomingImages = Array.isArray(submissionData?.images) ? submissionData.images : [];
      if (!incomingImages.length) {
        setSelectedImageId(null);
        setSelectedImage(null);
      } else {
        const existing = incomingImages.find(img => String(img.id) === String(selectedImageId));
        const next = existing || [...incomingImages].sort((a, b) => Number(a.page_number || 0) - Number(b.page_number || 0))[0];
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

  const reorderImages = async orderedIds => {
    if (!submission?.id || !orderedIds?.length) return;
    setIsReordering(true);
    setError('');
    setFlash('');
    try {
      await apiJson('/submission-images/reorder/', {
        method: 'POST',
        body: { submission: submission.id, ordered_image_ids: orderedIds },
      });
      setSubmission(prev => {
        if (!prev) return prev;
        const idToImg = new Map((prev.images || []).map(img => [img.id, { ...img }]));
        const nextImages = orderedIds.map((id, index) => ({
          ...idToImg.get(id),
          page_number: index + 1,
        }));
        return { ...prev, images: nextImages };
      });
      setFlash('Pages reordered.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reorder pages.');
    } finally {
      setIsReordering(false);
    }
  };

  const moveImage = (index, direction) => {
    if (!images.length) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    const ordered = [...images];
    const [picked] = ordered.splice(index, 1);
    ordered.splice(nextIndex, 0, picked);
    reorderImages(ordered.map(img => img.id));
  };

  const openAnnotation = image => {
    if (!canAnnotate) return;
    setAnnotationImage(image);
    requestAnimationFrame(() => openOverlay(ANNOTATE_MODAL_ID));
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
              <Link className="btn btn-sm bg-default-200" to="/portal/homework/submissions">
                Back
              </Link>
              <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); load(); }} disabled={isLoading}>
                <LuRefreshCw className="inline size-4" /> Refresh
              </button>
              <button className="btn btn-sm bg-primary text-white" onClick={downloadPdf} disabled={!images.length}>
                <LuDownload className="inline size-4" /> Download PDF
              </button>
            </div>
          </div>

          <div className="card-body">
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            {flash ? <div className="mb-3 text-sm text-success">{flash}</div> : null}
            {isLoading ? <div className="text-sm">Loading...</div> : null}

            {submission ? (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-8 space-y-4">
                  <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                    <div className="text-sm text-default-700 flex flex-wrap gap-2">
                      <span>Student: <span className="font-semibold">{submission.student_name}</span></span>
                      <span>Status: <span className="font-semibold">{submission.status}</span></span>
                      {submission.submitted_at ? (
                        <span>Submitted: <span className="font-semibold">{String(submission.submitted_at).slice(0, 19).replace('T', ' ')}</span></span>
                      ) : null}
                      {submission.is_late_submission ? <span className="text-danger font-semibold">Late submission</span> : null}
                    </div>
                    {submission.content_html ? (
                      <div className="mt-3 rounded-md border border-default-200 bg-white p-3">
                        <div className="mb-2 text-sm font-medium text-default-700">Written answer</div>
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: submission.content_html }} />
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-default-800">Submission pages</div>
                        <div className="text-xs text-default-500">Select a page to preview, annotate, or reorder.</div>
                      </div>
                      {isReordering ? <div className="text-xs text-default-500">Saving page order...</div> : null}
                    </div>

                    {!images.length ? (
                      <div className="text-sm text-default-600">No pages uploaded yet.</div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <div className="lg:col-span-4 space-y-2">
                          {images.map((img, index) => {
                            const active = String(img.id) === String(selectedImageId);
                            return (
                              <div
                                key={img.id}
                                className={`rounded-md border p-2 ${active ? 'border-primary bg-primary/5' : 'border-default-200 bg-white'}`}
                              >
                                <button
                                  type="button"
                                  className="w-full text-left"
                                  onClick={() => setSelectedImageId(img.id)}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium text-default-800">Page {img.page_number || index + 1}</div>
                                    <div className="text-xs text-default-500">#{img.id}</div>
                                  </div>
                                  <img
                                    src={resolveApiUrl(img.image)}
                                    alt={`Submission page ${img.page_number || index + 1}`}
                                    className="mt-2 h-28 w-full rounded border border-default-200 object-cover bg-default-100"
                                  />
                                </button>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {canReorder ? (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-xs bg-default-200"
                                        onClick={() => moveImage(index, -1)}
                                        disabled={isReordering || index === 0}
                                      >
                                        <LuArrowUp className="inline size-3.5" /> Up
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-xs bg-default-200"
                                        onClick={() => moveImage(index, 1)}
                                        disabled={isReordering || index === images.length - 1}
                                      >
                                        <LuArrowDown className="inline size-3.5" /> Down
                                      </button>
                                    </>
                                  ) : null}
                                  {canAnnotate ? (
                                    <button
                                      type="button"
                                      className="btn btn-xs bg-primary text-white"
                                      onClick={() => openAnnotation(img)}
                                    >
                                      <LuMessageSquare className="inline size-3.5" /> Annotate
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="lg:col-span-8">
                          {selectedImage ? (
                            <div className="rounded-md border border-default-200 bg-white p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="text-sm font-medium text-default-800">Page {selectedImage.page_number}</div>
                                {canAnnotate ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm bg-primary text-white"
                                    onClick={() => openAnnotation(selectedImage)}
                                  >
                                    <LuMessageSquare className="inline size-4" /> Annotate this page
                                  </button>
                                ) : null}
                              </div>
                              <img
                                src={resolveApiUrl(selectedImage.image)}
                                alt={`Submission page ${selectedImage.page_number}`}
                                className="w-full rounded border border-default-200 bg-default-100"
                              />
                            </div>
                          ) : (
                            <div className="text-sm text-default-600">Select a page to preview.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="xl:col-span-4 space-y-4">
                  <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                    <div className="text-sm font-semibold text-default-800 mb-2">Grading</div>
                    {!isTeacher ? (
                      <div className="text-sm text-default-600">Only teachers/admin can grade.</div>
                    ) : (
                      <>
                        <div className="mb-3">
                          <label className="inline-block mb-2 text-sm font-medium">Marks</label>
                          <input className="form-input w-full" value={marks} onChange={e => setMarks(e.target.value)} disabled={isGrading} placeholder="80/100" />
                          <div className="mt-2 text-xs text-default-500">
                            Instruction: `90/100` means `obtained marks / total marks`.
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="inline-block mb-2 text-sm font-medium">Feedback</label>
                          <textarea className="form-input w-full min-h-24" value={feedback} onChange={e => setFeedback(e.target.value)} disabled={isGrading} />
                        </div>
                        <button className="btn bg-primary text-white w-full" onClick={grade} disabled={isGrading || !canGrade}>
                          <LuSave className="inline size-4" /> Save grade
                        </button>
                      </>
                    )}
                  </div>

                  <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                    <div className="text-sm font-semibold text-default-800 mb-2">Grade history</div>
                    {!gradeLogs.length ? (
                      <div className="text-sm text-default-600">No grade history yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {gradeLogs.map(log => (
                          <div key={log.id} className="rounded-md border border-default-200 bg-white p-2">
                            <div className="text-sm font-medium text-default-800">Marks: {log.marks_display || log.marks}</div>
                            <div className="text-xs text-default-500">
                              {log.graded_by_label || 'Unknown'} | {String(log.graded_at || '').slice(0, 19).replace('T', ' ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {canAnnotate ? <SubmissionAnnotationModal image={annotationImage} onSaved={handleAnnotationSaved} /> : null}
      </main>
    </>
  );
};

export default HomeworkSubmissionDetail;
