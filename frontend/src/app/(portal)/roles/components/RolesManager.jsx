import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { LuPencil, LuPlus, LuSettings2, LuTrash2 } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { canPortal } from '@/utils/portalPermissions';
import { openOverlay } from '@/utils/overlay';

import AssignRoleUsersModal from './AssignRoleUsersModal';

const RolesManager = () => {
  const navigate = useNavigate();

  const canView = useMemo(() => canPortal('/portal/roles', 'view'), []);
  const canCreate = useMemo(() => canPortal('/portal/roles', 'create'), []);
  const canEdit = useMemo(() => canPortal('/portal/roles', 'edit'), []);
  const canDelete = useMemo(() => canPortal('/portal/roles', 'delete'), []);

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [assigningRole, setAssigningRole] = useState(null);

  const load = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await apiJson('/portal-roles/?page=1');
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roles.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const save = async () => {
    setError('');
    const isEdit = Boolean(editingRole?.id);
    if (isEdit && !canEdit) {
      setError('You do not have permission to edit roles.');
      return;
    }
    if (!isEdit && !canCreate) {
      setError('You do not have permission to create roles.');
      return;
    }
    if (!name.trim()) {
      setError('Role name is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = { name: name.trim(), is_active: Boolean(isActive) };
      if (isEdit) {
        const updated = await apiJson(`/portal-roles/${editingRole.id}/`, { method: 'PATCH', body: payload });
        setItems(prev => (Array.isArray(prev) ? prev.map(r => (r.id === updated.id ? updated : r)) : [updated]));
        setFlash('Role updated.');
      } else {
        const created = await apiJson('/portal-roles/', { method: 'POST', body: payload });
        setItems(prev => [created, ...(Array.isArray(prev) ? prev : [])]);
        setFlash('Role created.');
      }
      setName('');
      setIsActive(true);
      setEditingRole(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${editingRole?.id ? 'update' : 'create'} role.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = role => {
    if (!role?.id) return;
    setError('');
    setEditingRole(role);
    setName(role?.name || '');
    setIsActive(Boolean(role?.is_active));
  };

  const cancelEdit = () => {
    setEditingRole(null);
    setName('');
    setIsActive(true);
    setError('');
  };

  const remove = async role => {
    if (!role?.id) return;
    setError('');
    if (!canDelete) {
      setError('You do not have permission to delete roles.');
      return;
    }
    if (!confirm(`Delete role "${role.name}"?`)) return;
    setIsSubmitting(true);
    try {
      await apiJson(`/portal-roles/${role.id}/`, { method: 'DELETE' });
      setItems(prev => (Array.isArray(prev) ? prev.filter(r => r.id !== role.id) : []));
      if (editingRole?.id === role.id) cancelEdit();
      setFlash('Role deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete role.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canView) {
    return <div className="p-5 text-sm text-danger">You do not have permission to view roles.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {flash ? (
        <div className="px-5">
          <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-default-800">{flash}</div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h6 className="card-title">{editingRole?.id ? 'Edit Role' : 'Create Role'}</h6>
        </div>
        <div className="p-5">
          {error ? <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="inline-block mb-2 text-base font-medium">Role name</label>
              <input
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isSubmitting || (editingRole?.id ? !canEdit : !canCreate)}
              />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input
                id="role-active"
                className="form-checkbox rounded"
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                disabled={isSubmitting || (editingRole?.id ? !canEdit : !canCreate)}
              />
              <label htmlFor="role-active" className="text-sm text-default-700">Active</label>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            {editingRole?.id ? (
              <button type="button" className="btn bg-default-100 text-default-800" onClick={cancelEdit} disabled={isSubmitting}>
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              className="btn bg-primary text-white flex items-center gap-2"
              onClick={save}
              disabled={isSubmitting || (editingRole?.id ? !canEdit : !canCreate)}
            >
              <LuPlus className="size-4" /> {isSubmitting ? 'Saving...' : editingRole?.id ? 'Update Role' : 'Create Role'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h6 className="card-title">Roles</h6>
          <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={load} disabled={isLoading}>
            Refresh
          </button>
        </div>
        <div className="p-5">
          {isLoading ? <div className="text-sm text-default-500">Loading...</div> : null}
          {!isLoading && !items.length ? <div className="text-sm text-default-500">No roles found.</div> : null}

          {items.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-default-200">
                <thead className="bg-default-100 font-normal whitespace-nowrap">
                  <tr className="text-sm text-default-800">
                    <th className="px-3.5 py-3 font-medium text-start">Role</th>
                    <th className="px-3.5 py-3 font-medium text-start">Active</th>
                    <th className="px-3.5 py-3 font-medium text-start">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {items.map(r => (
                    <tr key={r.id} className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-3 text-sm">{r.name}</td>
                      <td className="px-3.5 py-3 text-sm">{r.is_active ? 'Yes' : 'No'}</td>
                      <td className="px-3.5 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-sm bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600 flex items-center gap-2"
                            onClick={() => navigate(`/portal/roles/${r.id}/permissions`)}
                          >
                            <LuSettings2 className="size-4" /> Permissions
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                            onClick={() => {
                              setAssigningRole(r);
                              requestAnimationFrame(() => openOverlay('#role-assign-users-modal'));
                            }}
                            disabled={!canEdit}
                          >
                            Assign users
                          </button>
                          <button
                            type="button"
                            className="btn size-8 bg-default-200 hover:bg-primary/10 hover:text-primary text-default-600"
                            title="Edit"
                            onClick={() => startEdit(r)}
                            disabled={!canEdit}
                          >
                            <LuPencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="btn size-8 bg-default-200 hover:bg-danger/10 hover:text-danger text-default-600"
                            title="Delete"
                            onClick={() => remove(r)}
                            disabled={!canDelete}
                          >
                            <LuTrash2 className="size-4" />
                          </button>
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

      <AssignRoleUsersModal role={assigningRole} canEdit={canEdit} onChanged={load} />
    </div>
  );
};

export default RolesManager;
