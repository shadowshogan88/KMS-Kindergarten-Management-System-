import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const PortalExamAuditLogs = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canUseApi = Boolean(authStorage.getAccess());

  const load = async () => {
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await apiJson('/audit-logs/');
      const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit logs.');
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
      <PageMeta title="Audit Logs" />
      <main>
        <PageBreadcrumb title="Audit Logs" subtitle="Exam" />

        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h6 className="card-title">Audit Logs</h6>
            <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); load(); }}>
              Refresh
            </button>
          </div>
          <div className="card-body">
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            {isLoading ? <div className="text-sm">Loading...</div> : null}
            {!isLoading && items.length === 0 ? <div className="text-sm text-default-600">No logs found.</div> : null}
            {items.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-default-200">
                  <thead className="font-semibold whitespace-nowrap">
                    <tr className="text-sm text-default-800 divide-x divide-default-200">
                      <th className="px-3.5 py-3 text-start">Time</th>
                      <th className="px-3.5 py-3 text-start">Action</th>
                      <th className="px-3.5 py-3 text-start">User</th>
                      <th className="px-3.5 py-3 text-start">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                    {items.map(row => (
                      <tr key={row.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                        <td className="px-3.5 py-3 text-sm">{String(row.timestamp || '').slice(0, 19).replace('T', ' ')}</td>
                        <td className="px-3.5 py-3 text-sm">{row.action_type}</td>
                        <td className="px-3.5 py-3 text-sm">{row.user_label || '-'}</td>
                        <td className="px-3.5 py-3 text-xs">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(row.details || {}, null, 2)}</pre>
                        </td>
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

export default PortalExamAuditLogs;

