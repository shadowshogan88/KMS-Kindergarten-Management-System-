import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router';
import { LuSearch } from 'react-icons/lu';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const HomeworkSubmissions = () => {
  const canUseApi = Boolean(authStorage.getAccess());
  const [homeworkId, setHomeworkId] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('homework') || '';
    } catch {
      return '';
    }
  });
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const qs = homeworkId ? `?homework=${encodeURIComponent(homeworkId)}` : '';
      const data = await apiJson(`/submissions/${qs}`);
      const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submissions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!canUseApi) return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;

  return (
    <>
      <PageMeta title="Review Submissions" />
      <main>
        <PageBreadcrumb title="Review Submissions" subtitle="Educational" />
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h6 className="card-title">Submissions</h6>
          </div>
          <div className="card-body">
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            <div className="mb-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-default-900">Submission Filters</div>
                  <div className="text-sm text-default-600">Load submissions by homework id.</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-default-500">Live Count</div>
                  <div className="mt-1 text-xl font-semibold text-default-900">{items.length}</div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-xs">
                  <input className="form-input ps-11" placeholder="Homework ID" value={homeworkId} onChange={e => setHomeworkId(e.target.value)} />
                  <div className="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
                    <LuSearch className="size-4 text-default-500" />
                  </div>
                </div>
                <button className="btn bg-default-900 text-white px-5" onClick={e => { e.preventDefault(); load(); }}>
                  Load
                </button>
              </div>
            </div>
            {isLoading ? <div className="text-sm">Loading...</div> : null}
            {!isLoading && items.length === 0 ? <div className="text-sm text-default-600">No submissions found.</div> : null}
            {items.length ? (
              <div className="portal-table-shell">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-default-200">
                  <thead className="font-semibold whitespace-nowrap bg-default-50">
                    <tr className="text-sm text-default-800 divide-x divide-default-200">
                      <th className="px-3.5 py-3 text-start">ID</th>
                      <th className="px-3.5 py-3 text-start">Student</th>
                      <th className="px-3.5 py-3 text-start">Status</th>
                      <th className="px-3.5 py-3 text-start">Submitted</th>
                      <th className="px-3.5 py-3 text-start">Late</th>
                      <th className="px-3.5 py-3 text-start">Marks</th>
                      <th className="px-3.5 py-3 text-start">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                    {items.map(s => (
                      <tr key={s.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                        <td className="px-3.5 py-3 text-sm">{s.id}</td>
                        <td className="px-3.5 py-3 text-sm">{s.student_name}</td>
                        <td className="px-3.5 py-3 text-sm">{s.status}</td>
                        <td className="px-3.5 py-3 text-sm">{String(s.submitted_at || '').slice(0, 19).replace('T', ' ') || '-'}</td>
                        <td className="px-3.5 py-3 text-sm">{s.is_late_submission ? 'YES' : 'NO'}</td>
                        <td className="px-3.5 py-3 text-sm">{s.teacher_marks ?? '-'}</td>
                        <td className="px-3.5 py-3 text-sm">
                          <Link className="text-primary underline" to={`/portal/homework/submissions/${s.id}`}>
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
            <div className="mt-3 text-xs text-default-600">
              Next: We can add submission detail (pages reorder, annotation, grading UI).
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default HomeworkSubmissions;
