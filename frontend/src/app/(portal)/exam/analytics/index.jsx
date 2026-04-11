import { useState } from 'react';
import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const PortalExamAnalytics = () => {
  const [examId, setExamId] = useState('');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canUseApi = Boolean(authStorage.getAccess());

  const load = async () => {
    if (!canUseApi) return;
    if (!examId) {
      setError('Exam ID is required.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const out = await apiJson(`/exams/${examId}/analytics/`);
      setData(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (!canUseApi) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Exam Analytics" />
      <main>
        <PageBreadcrumb title="Analytics" subtitle="Exam" />

        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h6 className="card-title">Analytics</h6>
            <div className="flex items-center gap-2">
              <input className="form-input w-40" placeholder="Exam ID" value={examId} onChange={e => setExamId(e.target.value)} />
              <button className="btn btn-sm bg-primary text-white" onClick={e => { e.preventDefault(); load(); }}>
                Load
              </button>
            </div>
          </div>
          <div className="card-body">
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            {isLoading ? <div className="text-sm">Loading...</div> : null}

            {data ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded border border-default-200 p-3">
                  <div className="text-xs text-default-500">Students</div>
                  <div className="text-xl font-semibold">{data.students_total}</div>
                </div>
                <div className="rounded border border-default-200 p-3">
                  <div className="text-xs text-default-500">Pass %</div>
                  <div className="text-xl font-semibold">{data.pass_percentage}%</div>
                </div>
                <div className="rounded border border-default-200 p-3">
                  <div className="text-xs text-default-500">Failed</div>
                  <div className="text-xl font-semibold">{data.failed}</div>
                </div>

                <div className="md:col-span-3">
                  <h6 className="mb-2 font-semibold">Topper Analytics</h6>
                  {Array.isArray(data.toppers) && data.toppers.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-default-200">
                        <thead className="font-semibold whitespace-nowrap">
                          <tr className="text-sm text-default-800 divide-x divide-default-200">
                            <th className="px-3.5 py-3 text-start">Rank</th>
                            <th className="px-3.5 py-3 text-start">Student</th>
                            <th className="px-3.5 py-3 text-start">Total</th>
                            <th className="px-3.5 py-3 text-start">GPA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-default-200">
                          {data.toppers.map(t => (
                            <tr key={t.student_id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                              <td className="px-3.5 py-3 text-sm">{t.rank}</td>
                              <td className="px-3.5 py-3 text-sm">{`${t.first_name || ''} ${t.last_name || ''}`.trim()}</td>
                              <td className="px-3.5 py-3 text-sm">{t.total_marks}</td>
                              <td className="px-3.5 py-3 text-sm">{t.gpa}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-default-600">No topper data.</div>
                  )}
                </div>

                <div className="md:col-span-3">
                  <h6 className="mb-2 font-semibold">Subject Performance</h6>
                  {Array.isArray(data.subject_performance) && data.subject_performance.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-default-200">
                        <thead className="font-semibold whitespace-nowrap">
                          <tr className="text-sm text-default-800 divide-x divide-default-200">
                            <th className="px-3.5 py-3 text-start">Subject</th>
                            <th className="px-3.5 py-3 text-start">Average Marks</th>
                            <th className="px-3.5 py-3 text-start">Count</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-default-200">
                          {data.subject_performance.map(s => (
                            <tr key={s.subject_id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                              <td className="px-3.5 py-3 text-sm">
                                {s.subject_code} - {s.subject_name}
                              </td>
                              <td className="px-3.5 py-3 text-sm">{s.avg_marks}</td>
                              <td className="px-3.5 py-3 text-sm">{s.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-default-600">No subject performance data.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
};

export default PortalExamAnalytics;

