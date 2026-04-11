import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { LuCamera, LuPencilLine, LuRefreshCw, LuSave, LuSend } from 'react-icons/lu';

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

const HomeworkSubmit = () => {
  const canUseApi = Boolean(authStorage.getAccess());
  const user = authStorage.getUser();
  const role = user?.role || '';
  const { homeworkId } = useParams();

  const [homework, setHomework] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [images, setImages] = useState([]);
  const [orderedIds, setOrderedIds] = useState([]);

  const [activeImage, setActiveImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const isStudent = role === 'STUDENT';

  const canEdit = useMemo(() => {
    if (!isStudent) return false;
    const st = submission?.status;
    return st !== 'SUBMITTED' && st !== 'GRADED';
  }, [isStudent, submission?.status]);

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
        const subFull = await apiJson(`/submissions/${sub.id}/`);
        setSubmission(subFull);
        const imgRows = sortImages(subFull.images);
        setImages(imgRows);
        setOrderedIds(imgRows.map(i => i.id));
      } else {
        setSubmission(null);
        setImages([]);
        setOrderedIds([]);
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

  const onDragStart = (e, id) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
  };

  const onDrop = (e, id) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain');
    if (!fromId) return;
    const fromIdx = orderedIds.findIndex(x => String(x) === String(fromId));
    const toIdx = orderedIds.findIndex(x => String(x) === String(id));
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    setOrderedIds(prev => moveItem(prev, fromIdx, toIdx));
  };

  const saveOrder = async () => {
    if (!submission?.id || orderedIds.length < 1) return;
    setError('');
    setFlash('');
    setIsSavingOrder(true);
    try {
      await apiJson('/submission-images/reorder/', {
        method: 'POST',
        body: { submission: submission.id, ordered_image_ids: orderedIds },
      });
      setFlash('Page order saved.');
      await load({ ensureSubmission: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reorder pages.');
    } finally {
      setIsSavingOrder(false);
    }
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
    setActiveImage(img || null);
    openOverlay('#submission-annotate-modal');
  };

  if (!canUseApi) return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;

  return (
    <>
      <PageMeta title="Submit Homework" />
      <main>
        <PageBreadcrumb title="Submit Homework" subtitle="Educational" />

        <div className="card">
          <div className="card-header flex justify-between items-center">
            <div className="min-w-0">
              <h6 className="card-title truncate">Homework #{homeworkId}</h6>
              <div className="text-xs text-default-600 truncate">{homework?.title || ''}</div>
            </div>
            <div className="flex gap-2">
              <Link className="btn btn-sm bg-default-200" to="/portal/homework">
                Back
              </Link>
              <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); load(); }} disabled={isLoading || isUploading}>
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
                <Link className="text-primary underline" to="/portal/homework/submissions">
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
                      <label className={`btn btn-sm ${canEdit ? 'bg-primary text-white' : 'bg-default-200 text-default-500'}`}>
                        <LuCamera className="inline size-4" /> Add photos
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          className="hidden"
                          disabled={!canEdit || isUploading}
                          onChange={e => uploadFiles(e.target.files)}
                        />
                      </label>
                      <button className="btn btn-sm bg-default-200" onClick={saveOrder} disabled={!canEdit || isSavingOrder || orderedIds.length < 2}>
                        <LuSave className="inline size-4" /> Save order
                      </button>
                      <button className="btn btn-sm bg-primary text-white" onClick={submitFinal} disabled={!canEdit || isSubmitting || orderedIds.length < 1}>
                        <LuSend className="inline size-4" /> Submit
                      </button>
                    </div>
                  </div>

                  {isUploading ? <div className="mt-2 text-sm text-default-500">Uploading...</div> : null}

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {orderedIds.map(id => {
                      const img = images.find(i => String(i.id) === String(id));
                      if (!img) return null;
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
                            <img src={resolveApiUrl(img.image)} alt={`Page ${img.page_number}`} className="w-full aspect-[3/4] object-cover" />
                            <div className="absolute top-1 left-1 rounded bg-black/70 text-white text-xs px-2 py-0.5">
                              #{img.page_number}
                            </div>
                          </div>
                          <div className="p-2 flex items-center justify-between gap-2">
                            <button className="btn btn-xs bg-default-200" onClick={e => { e.preventDefault(); openAnnotate(img); }}>
                              <LuPencilLine className="inline size-4" /> Annotate
                            </button>
                            <span className="text-[11px] text-default-500">Drag to reorder</span>
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
                </div>

                <div className="lg:col-span-1">
                  <div className="rounded-lg border border-default-200 p-3 bg-default-50">
                    <div className="text-sm font-semibold text-default-800 mb-2">Homework</div>
                    <div className="text-sm text-default-700">
                      {homework?.description ? <span>{homework.description}</span> : <span className="text-default-500">No description.</span>}
                    </div>
                    {homework?.due_date ? (
                      <div className="mt-2 text-xs text-default-600">
                        Due: {String(homework.due_date).slice(0, 19).replace('T', ' ')}
                        {homework.allow_late_submission ? ' (late allowed)' : ''}
                      </div>
                    ) : null}
                    {homework?.pdf_file ? (
                      <a className="mt-3 inline-block text-primary underline text-sm" href={resolveApiUrl(homework.pdf_file)} target="_blank" rel="noreferrer">
                        Open attachment
                      </a>
                    ) : null}
                    <div className="mt-3 text-xs text-default-600">
                      Tip: On mobile, “Add photos” opens the camera. You can select multiple shots before uploading.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <SubmissionAnnotationModal
        image={activeImage}
        onSaved={msg => {
          if (msg) setFlash(msg);
        }}
      />
    </>
  );
};

export default HomeworkSubmit;

