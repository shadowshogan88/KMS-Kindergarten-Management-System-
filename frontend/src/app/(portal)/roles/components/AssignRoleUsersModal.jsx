import { useEffect, useMemo, useState } from 'react';
import { LuSearch, LuX } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { closeOverlay } from '@/utils/overlay';

const closeModal = () => closeOverlay('#role-assign-users-modal');

const AssignRoleUsersModal = ({ role, canEdit, onChanged }) => {
  const roleId = role?.id ? String(role.id) : '';

  const [q, setQ] = useState('');
  const [userRole, setUserRole] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');

  const canUseApi = useMemo(() => Boolean(authStorage.getAccess()), []);

  const load = async () => {
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('page', '1');
      if (q.trim()) qs.set('q', q.trim());
      if (userRole) qs.set('role', userRole);
      if (onlyUnassigned) qs.set('unassigned', '1');
      const data = await apiJson(`/users/?${qs.toString()}`);
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // reset on open role change
    setQ('');
    setUserRole('');
    setOnlyUnassigned(false);
    setItems([]);
    setError('');
    if (roleId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const isAssignedToThisRole = user => String(user?.portal_role_id || '') === String(roleId);

  const toggleAssign = async (user, nextAssigned) => {
    if (!user?.id || !roleId) return;
    if (!canEdit) return;
    setSavingId(String(user.id));
    setError('');
    try {
      const body = { portal_role: nextAssigned ? Number(roleId) : null };
      const updated = await apiJson(`/users/${user.id}/`, { method: 'PATCH', body });
      setItems(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      await onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign role.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div
      id="role-assign-users-modal"
      className="hs-overlay hidden size-full fixed top-0 start-0 z-80 overflow-x-hidden overflow-y-auto pointer-events-none hs-overlay-open:pointer-events-auto"
      role="dialog"
      tabIndex={-1}
      aria-labelledby="role-assign-users-modal-label"
    >
      <div className="hs-overlay-animation-target hs-overlay-open:scale-100 hs-overlay-open:opacity-100 scale-95 opacity-0 ease-in-out transition-all duration-200 sm:max-w-3xl sm:w-full m-3 sm:mx-auto min-h-[calc(100%-56px)] flex items-center">
        <div className="w-full flex flex-col card border border-default-200 shadow-2xs rounded-xl pointer-events-auto">
          <div className="card-header">
            <h3 id="role-assign-users-modal-label" className="font-bold text-default-800 text-base">
              Assign users{role?.name ? `: ${role.name}` : ''}
            </h3>
            <div>
              <button type="button" className="size-5 text-default-800" aria-label="Close" onClick={closeModal}>
                <span className="sr-only">Close</span>
                <LuX className="size-5" />
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto">
            {error ? (
              <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2">
                <label className="sr-only">Search</label>
                <div className="relative">
                  <input className="ps-11 form-input" placeholder="Search user..." value={q} onChange={e => setQ(e.target.value)} />
                  <div className="absolute inset-y-0 start-0 flex items-center pointer-events-none ps-4">
                    <LuSearch className="size-4 text-default-500" />
                  </div>
                </div>
              </div>
              <div>
                <label className="sr-only">User type</label>
                <select className="form-input" value={userRole} onChange={e => setUserRole(e.target.value)}>
                  <option value="">All</option>
                  <option value="ADMIN">Admin</option>
                  <option value="TEACHER">Teacher</option>
                  <option value="STUDENT">Student</option>
                  <option value="PARENT">Parent</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="only-unassigned"
                  className="form-checkbox rounded"
                  type="checkbox"
                  checked={onlyUnassigned}
                  onChange={e => setOnlyUnassigned(e.target.checked)}
                />
                <label htmlFor="only-unassigned" className="text-sm text-default-700">
                  Unassigned
                </label>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button type="button" className="btn bg-default-200 hover:bg-default-300 text-default-700" onClick={load} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Search'}
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-default-200">
                <thead className="bg-default-100 font-normal whitespace-nowrap">
                  <tr className="text-sm text-default-800">
                    <th className="px-3.5 py-3 font-medium text-start">User</th>
                    <th className="px-3.5 py-3 font-medium text-start">Type</th>
                    <th className="px-3.5 py-3 font-medium text-start">Current Role</th>
                    <th className="px-3.5 py-3 font-medium text-start">Assigned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {isLoading ? (
                    <tr className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-4 text-sm" colSpan={4}>
                        Loading...
                      </td>
                    </tr>
                  ) : !items.length ? (
                    <tr className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-4 text-sm" colSpan={4}>
                        No users found.
                      </td>
                    </tr>
                  ) : null}

                  {items.map(u => {
                    const assigned = isAssignedToThisRole(u);
                    const disabled = !canEdit || savingId === String(u.id);
                    return (
                      <tr key={u.id} className="text-default-800 font-normal whitespace-nowrap">
                        <td className="px-3.5 py-3 text-sm">
                          <div className="font-medium">{u.username}</div>
                          <div className="text-xs text-default-500">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '-'}</div>
                        </td>
                        <td className="px-3.5 py-3 text-sm">{u.role || '-'}</td>
                        <td className="px-3.5 py-3 text-sm">{u.portal_role_name || '-'}</td>
                        <td className="px-3.5 py-3 text-sm">
                          <input
                            type="checkbox"
                            className="form-checkbox rounded-full"
                            checked={assigned}
                            disabled={disabled}
                            onChange={e => toggleAssign(u, e.target.checked)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!canEdit ? (
              <div className="mt-3 text-xs text-default-500">You need Edit permission on Roles to assign users.</div>
            ) : null}
          </div>

          <div className="card-footer flex justify-end gap-2">
            <button type="button" className="btn bg-default-100 text-default-800" onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignRoleUsersModal;
