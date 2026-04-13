import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const AssignmentList = () => {
  const canUseApi = Boolean(authStorage.getAccess());
  const user = authStorage.getUser();
  const role = user?.role || '';
  const canPublish = role === 'ADMIN' || role === 'TEACHER';
  const canDelete = role === 'ADMIN' || role === 'TEACHER';
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await apiJson('/homeworks/?type=ASSIGNMENT');
      const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assignments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const deleteAssignment = async assignmentId => {
    const ok = window.confirm('Delete this assignment?');
    if (!ok) return;
    setBusyId(assignmentId);
    setError('');
    try {
      await apiJson(`/homeworks/${assignmentId}/`, { method: 'DELETE' });
      setItems(prev => prev.filter(item => item.id !== assignmentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete assignment.');
    } finally {
      setBusyId(null);
    }
  };

  const publishAssignment = async assignmentId => {
    setBusyId(assignmentId);
    setError('');
    try {
      await apiJson(`/homeworks/${assignmentId}/publish/`, { method: 'POST' });
      setItems(prev => prev.map(item => (item.id === assignmentId ? { ...item, status: 'PUBLISHED' } : item)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish assignment.');
    } finally {
      setBusyId(null);
    }
  };

  if (!canUseApi) return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;

  return (
    <>
      <PageMeta title="Assignment" />
      <main>
        <PageBreadcrumb title="Assignment" subtitle="Educational" />
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h6 className="card-title">Assignment List</h6>
            <div className="flex gap-2">
              <Link className="btn btn-sm bg-primary text-white" to="/portal/assignment/create">
                Create
              </Link>
              <button className="btn btn-sm bg-default-200" onClick={e => { e.preventDefault(); load(); }}>
                Refresh
              </button>
            </div>
          </div>
          <div className="card-body">
            {error ? <div className="mb-3 text-sm text-danger">{error}</div> : null}
            {isLoading ? <div className="text-sm">Loading...</div> : null}
            {!isLoading && items.length === 0 ? <div className="text-sm text-default-600">No assignment found.</div> : null}
            {items.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-default-200">
                  <thead className="font-semibold whitespace-nowrap">
                    <tr className="text-sm text-default-800 divide-x divide-default-200">
                      <th className="px-3.5 py-3 text-start">ID</th>
                      <th className="px-3.5 py-3 text-start">Title</th>
                      <th className="px-3.5 py-3 text-start">Class</th>
                      <th className="px-3.5 py-3 text-start">Due</th>
                      <th className="px-3.5 py-3 text-start">Status</th>
                      <th className="px-3.5 py-3 text-start">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-default-200">
                    {items.map(hw => (
                      <tr key={hw.id} className="text-default-800 font-normal whitespace-nowrap divide-x divide-default-200">
                        <td className="px-3.5 py-3 text-sm">{hw.id}</td>
                        <td className="px-3.5 py-3 text-sm">{hw.title}</td>
                        <td className="px-3.5 py-3 text-sm">{hw.classroom_label || hw.class_label}</td>
                        <td className="px-3.5 py-3 text-sm">{String(hw.due_date || '').slice(0, 19).replace('T', ' ')}</td>
                        <td className="px-3.5 py-3 text-sm">{hw.status}</td>
                        <td className="px-3.5 py-3 text-sm">
                          <div className="flex items-center gap-3">
                            <Link className="text-primary underline" to={`/portal/homework/create?id=${encodeURIComponent(hw.id)}&mode=view`}>
                              View
                            </Link>
                            <Link className="text-primary underline" to={`/portal/homework/create?id=${encodeURIComponent(hw.id)}&mode=edit`}>
                              Edit
                            </Link>
                            <Link className="text-primary underline" to={`/portal/assignment/submissions?homework=${encodeURIComponent(hw.id)}`}>
                              Review
                            </Link>
                            {canPublish && hw.status !== 'PUBLISHED' ? (
                              <button
                                type="button"
                                className="text-success underline disabled:text-default-400"
                                disabled={busyId === hw.id}
                                onClick={() => publishAssignment(hw.id)}
                              >
                                {busyId === hw.id ? 'Publishing...' : 'Activate'}
                              </button>
                            ) : null}
                            {canDelete ? (
                              <button
                                type="button"
                                className="text-danger underline disabled:text-default-400"
                                disabled={busyId === hw.id}
                                onClick={() => deleteAssignment(hw.id)}
                              >
                                {busyId === hw.id ? 'Working...' : 'Delete'}
                              </button>
                            ) : null}
                          </div>
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

export default AssignmentList;
