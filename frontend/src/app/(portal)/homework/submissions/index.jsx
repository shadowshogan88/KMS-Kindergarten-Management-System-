import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router';
import { LuRefreshCw, LuSearch } from 'react-icons/lu';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const formatDate = value => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString();
};

const formatDateTime = value => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 19).replace('T', ' ');
  return parsed.toLocaleString();
};

const getRemainingLabel = (dueValue, nowMs) => {
  if (!dueValue) return '';
  const dueMs = new Date(dueValue).getTime();
  if (Number.isNaN(dueMs)) return '';
  const diffMs = dueMs - nowMs;
  if (diffMs <= 0) return 'Overdue';

  const totalMinutes = Math.ceil(diffMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes} min remaining`;

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''} remaining`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} min remaining`;
};

const getDueMetaLabel = (status, dueValue, nowMs) => {
  const base = getRemainingLabel(dueValue, nowMs);
  if ((status === 'SUBMITTED' || status === 'GRADED') && base === 'Overdue') return 'Complete';
  return base;
};

const HomeworkSubmissions = ({
  submissionType = '',
  pageTitle = 'Review Submissions',
  breadcrumbTitle = 'Review Submissions',
  filterEntityLabel = 'homework',
  metaCardLabel = 'Homework',
  detailBasePath = '/portal/homework/submissions',
}) => {
  const canUseApi = Boolean(authStorage.getAccess());
  const [searchParams, setSearchParams] = useSearchParams();
  const [homeworkId, setHomeworkId] = useState(() => searchParams.get('homework') || '');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [homeworkMeta, setHomeworkMeta] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const normalizedHomeworkId = useMemo(() => (searchParams.get('homework') || '').trim(), [searchParams]);

  useEffect(() => {
    setHomeworkId(normalizedHomeworkId);
  }, [normalizedHomeworkId]);

  const load = async () => {
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (normalizedHomeworkId) query.set('homework', normalizedHomeworkId);
      if (submissionType) query.set('type', submissionType);
      const qs = query.toString() ? `?${query.toString()}` : '';
      const [data, homeworkData] = await Promise.all([
        apiJson(`/submissions/${qs}`),
        normalizedHomeworkId ? apiJson(`/homeworks/${encodeURIComponent(normalizedHomeworkId)}/`).catch(() => null) : Promise.resolve(null),
      ]);
      const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(rows);
      setHomeworkMeta(homeworkData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submissions.');
      setHomeworkMeta(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedHomeworkId]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const applyFilter = () => {
    const next = new URLSearchParams(searchParams);
    const value = homeworkId.trim();
    if (value) next.set('homework', value);
    else next.delete('homework');
    setSearchParams(next);
  };

  const clearFilter = () => {
    setHomeworkId('');
    const next = new URLSearchParams(searchParams);
    next.delete('homework');
    setSearchParams(next);
  };

  if (!canUseApi) return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;

  return (
    <>
      <PageMeta title={pageTitle} />
      <main>
        <PageBreadcrumb title={breadcrumbTitle} subtitle="Educational" />
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h6 className="card-title">Submissions</h6>
            <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); load(); }} disabled={isLoading}>
              <LuRefreshCw className="inline size-4" /> Refresh
            </button>
          </div>
          <div className="card-body">
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            <div className="mb-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-default-900">Submission Filters</div>
                  <div className="text-sm text-default-600">Load submissions by {filterEntityLabel} id.</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-default-500">Live Count</div>
                  <div className="mt-1 text-xl font-semibold text-default-900">{items.length}</div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-xs">
                  <input
                    className="form-input ps-11"
                    placeholder={`${metaCardLabel} ID`}
                    value={homeworkId}
                    onChange={e => setHomeworkId(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') applyFilter();
                    }}
                  />
                  <div className="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
                    <LuSearch className="size-4 text-default-500" />
                  </div>
                </div>
                <button className="btn bg-default-200 px-5" onClick={clearFilter}>
                  Clear
                </button>
                <button className="btn bg-default-900 text-white px-5" onClick={applyFilter}>
                  Load
                </button>
              </div>
            </div>
            {homeworkMeta ? (
              <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">{metaCardLabel}</div>
                <div className="mt-1 text-sm font-semibold text-sky-950">
                  #{homeworkMeta.id} {homeworkMeta.title}
                </div>
                <div className="mt-1 text-xs text-sky-800">
                  {homeworkMeta.classroom_label || homeworkMeta.class_label || 'Class not set'} | {homeworkMeta.subject_label || 'Subject not set'}
                </div>
              </div>
            ) : null}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Draft</div>
                <div className="mt-1 text-sm text-amber-900">Student is still working. This submission is not final yet.</div>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">Submitted</div>
                <div className="mt-1 text-sm text-sky-800">Student has submitted the work. It is ready for teacher/admin review.</div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Graded</div>
                <div className="mt-1 text-sm text-emerald-900">Teacher or admin already reviewed and graded the submission.</div>
              </div>
            </div>
            {isLoading ? <div className="text-sm">Loading...</div> : null}
            {!isLoading && items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-default-300 bg-default-50 px-4 py-6 text-sm text-default-600">
                {normalizedHomeworkId
                  ? `Student has not submitted yet for ${filterEntityLabel} #${normalizedHomeworkId}. Draft work stays on the student side until they press Submit.`
                  : 'No submissions found.'}
              </div>
            ) : null}
            {items.length ? (
              <div className="portal-table-shell">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-default-200">
                  <thead className="font-semibold whitespace-nowrap bg-default-50">
                    <tr className="text-sm text-default-800 divide-x divide-default-200">
                      <th className="px-3.5 py-3 text-start">Roll</th>
                      <th className="px-3.5 py-3 text-start">Student</th>
                      <th className="px-3.5 py-3 text-start">Title</th>
                      <th className="px-3.5 py-3 text-start">Subject</th>
                      <th className="px-3.5 py-3 text-start">Class Date</th>
                      <th className="px-3.5 py-3 text-start">Due</th>
                      <th className="px-3.5 py-3 text-start">Status</th>
                      <th className="px-3.5 py-3 text-start">Submitted</th>
                      <th className="px-3.5 py-3 text-start">Late</th>
                      <th className="px-3.5 py-3 text-start">Marks</th>
                      <th className="px-3.5 py-3 text-start">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                    {items.map(s => (
                      <tr
                        key={s.id}
                        className={`text-default-800 font-normal whitespace-nowrap divide-x divide-default-200 ${
                          s.status === 'GRADED'
                            ? 'bg-emerald-100/80'
                            : s.status === 'SUBMITTED'
                              ? 'bg-sky-50/80'
                              : s.status === 'DRAFT'
                                ? 'bg-amber-50/90'
                              : ''
                        }`}
                      >
                        <td className="px-3.5 py-3 text-sm">{s.student_roll_no || '-'}</td>
                        <td className="px-3.5 py-3 text-sm">{s.student_name || '-'}</td>
                        <td className="px-3.5 py-3 text-sm">{homeworkMeta?.title || s.homework_title || '-'}</td>
                        <td className="px-3.5 py-3 text-sm">{s.homework_subject_label || homeworkMeta?.subject_label || '-'}</td>
                        <td className="px-3.5 py-3 text-sm">{formatDate(s.homework_class_date || homeworkMeta?.class_date)}</td>
                        <td className="px-3.5 py-3 text-sm">
                          <div>{formatDateTime(s.homework_due_date || homeworkMeta?.due_date)}</div>
                          {s.homework_due_date || homeworkMeta?.due_date ? (
                            <div
                              className={`mt-1 text-xs ${
                                (s.status === 'SUBMITTED' || s.status === 'GRADED') &&
                                getDueMetaLabel(s.status, s.homework_due_date || homeworkMeta?.due_date, nowMs) === 'Complete'
                                  ? 'font-semibold text-emerald-700'
                                  : 'text-default-500'
                              }`}
                            >
                              {getDueMetaLabel(s.status, s.homework_due_date || homeworkMeta?.due_date, nowMs)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3.5 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              s.status === 'GRADED'
                                ? 'bg-emerald-100 text-emerald-700'
                                : s.status === 'SUBMITTED'
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-sm">{String(s.submitted_at || '').slice(0, 19).replace('T', ' ') || '-'}</td>
                        <td className="px-3.5 py-3 text-sm">{s.is_late_submission ? 'YES' : 'NO'}</td>
                        <td className="px-3.5 py-3 text-sm">{s.marks_display || s.teacher_marks || '-'}</td>
                        <td className="px-3.5 py-3 text-sm">
                          <Link className="btn btn-sm bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200" to={`${detailBasePath}/${s.id}`}>
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
};

export default HomeworkSubmissions;
