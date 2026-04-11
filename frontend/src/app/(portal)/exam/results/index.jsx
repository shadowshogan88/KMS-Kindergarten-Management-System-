import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const PortalExamResults = () => {
  const [examId, setExamId] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canUseApi = Boolean(authStorage.getAccess());

  const load = async () => {
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (examId) params.set('exam', examId);
      if (q) params.set('q', q);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await apiJson(`/results/${qs}`);
      const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load results.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!canUseApi) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Results" />
      <main>
        <PageBreadcrumb title="Results" subtitle="Exam" />

        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h6 className="card-title">Results</h6>
            <div className="flex items-center gap-2">
              <input className="form-input w-36" placeholder="Exam ID" value={examId} onChange={e => setExamId(e.target.value)} />
              <input className="form-input w-48" placeholder="Search (ID/Name)" value={q} onChange={e => setQ(e.target.value)} />
              <button className="btn btn-sm bg-primary text-white" onClick={e => { e.preventDefault(); load(); }}>
                Load
              </button>
            </div>
          </div>
          <div className="card-body">
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            {isLoading ? <div className="text-sm">Loading...</div> : null}
            {!isLoading && items.length === 0 ? <div className="text-sm text-default-600">No results found.</div> : null}
            {items.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-default-200">
                  <thead className="font-semibold whitespace-nowrap">
                    <tr className="text-sm text-default-800 divide-x divide-default-200">
                      <th className="px-3.5 py-3 text-start">Rank</th>
                      <th className="px-3.5 py-3 text-start">Student</th>
                      <th className="px-3.5 py-3 text-start">Total</th>
                      <th className="px-3.5 py-3 text-start">GPA</th>
                      <th className="px-3.5 py-3 text-start">Grade</th>
                      <th className="px-3.5 py-3 text-start">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                    {items.map(row => (
                      <tr key={row.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                        <td className="px-3.5 py-3 text-sm">{row.rank ?? '-'}</td>
                        <td className="px-3.5 py-3 text-sm">{row.student_name}</td>
                        <td className="px-3.5 py-3 text-sm">{row.total_marks}</td>
                        <td className="px-3.5 py-3 text-sm">{row.gpa}</td>
                        <td className="px-3.5 py-3 text-sm">{row.final_grade}</td>
                        <td className="px-3.5 py-3 text-sm">{row.published_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
};

export default PortalExamResults;

