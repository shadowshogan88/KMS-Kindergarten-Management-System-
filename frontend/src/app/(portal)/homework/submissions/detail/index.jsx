import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { LuDownload, LuRefreshCw, LuSave } from 'react-icons/lu';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import PdfJsViewer from '@/app/(portal)/syllabus/components/PdfJsViewer';
import { apiJson } from '@/utils/api';
import { authStorage, getApiBaseUrl } from '@/utils/auth';

const parseFilename = cd => {
  if (!cd) return '';
  const m1 = String(cd).match(/filename\\*=UTF-8''([^;]+)/i);
  if (m1?.[1]) return decodeURIComponent(m1[1].replace(/\"/g, ''));
  const m2 = String(cd).match(/filename=([^;]+)/i);
  if (m2?.[1]) return m2[1].trim().replace(/^\"|\"$/g, '');
  return '';
};

const HomeworkSubmissionDetail = () => {
  const canUseApi = Boolean(authStorage.getAccess());
  const token = authStorage.getAccess();
  const user = authStorage.getUser();
  const role = user?.role || '';
  const isTeacher = role === 'TEACHER' || role === 'ADMIN';

  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const canGrade = useMemo(() => isTeacher && submission?.id, [isTeacher, submission?.id]);

  const load = async () => {
    if (!canUseApi || !submissionId) return;
    setIsLoading(true);
    setError('');
    setFlash('');
    try {
      const data = await apiJson(`/submissions/${encodeURIComponent(submissionId)}/`);
      setSubmission(data);
      setMarks(data?.teacher_marks ?? '');
      setFeedback(data?.teacher_feedback ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submission.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (!token || !submissionId) return;
      setPdfUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      try {
        const res = await fetch(`${getApiBaseUrl()}/submissions/${encodeURIComponent(submissionId)}/export-pdf/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const blob = await res.blob();
        if (!isMounted) return;
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch {}
    };
    run();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, token]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

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
      setFlash('Graded.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to grade.');
    } finally {
      setIsGrading(false);
    }
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
              <button className="btn btn-sm bg-primary text-white" onClick={downloadPdf} disabled={!pdfUrl}>
                <LuDownload className="inline size-4" /> Download PDF
              </button>
            </div>
          </div>

          <div className="card-body">
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            {flash ? <div className="mb-3 text-sm text-success">{flash}</div> : null}
            {isLoading ? <div className="text-sm">Loading...</div> : null}

            {submission ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2">
                  <div className="text-sm text-default-700 mb-3">
                    Student: <span className="font-semibold">{submission.student_name}</span> · Status:{' '}
                    <span className="font-semibold">{submission.status}</span>
                    {submission.submitted_at ? (
                      <span className="text-default-600">
                        {' '}
                        · Submitted: {String(submission.submitted_at).slice(0, 19).replace('T', ' ')}
                      </span>
                    ) : null}
                    {submission.is_late_submission ? <span className="text-danger"> · LATE</span> : null}
                  </div>

                  {pdfUrl ? <PdfJsViewer url={pdfUrl} /> : <div className="text-sm text-default-600">No pages uploaded yet.</div>}
                </div>

                <div className="xl:col-span-1">
                  <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                    <div className="text-sm font-semibold text-default-800 mb-2">Grading</div>
                    {!isTeacher ? (
                      <div className="text-sm text-default-600">Only teachers/admin can grade.</div>
                    ) : (
                      <>
                        <div className="mb-3">
                          <label className="inline-block mb-2 text-sm font-medium">Marks</label>
                          <input className="form-input w-full" value={marks} onChange={e => setMarks(e.target.value)} disabled={isGrading} />
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
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
};

export default HomeworkSubmissionDetail;
