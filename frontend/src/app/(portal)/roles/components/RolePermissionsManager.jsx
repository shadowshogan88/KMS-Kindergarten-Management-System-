import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LuArrowLeft, LuRefreshCcw, LuSave } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { menuItemsData } from '@/components/layouts/SideNav/menu';
import { canPortal } from '@/utils/portalPermissions';

const flattenPortalLinks = (items, out = []) => {
  for (const it of items || []) {
    if (it?.children?.length) flattenPortalLinks(it.children, out);
    if (it?.href && String(it.href).startsWith('/portal/')) out.push({ href: it.href, label: it.label || it.key || it.href });
  }
  return out;
};

const uniqByHref = list => {
  const seen = new Set();
  const out = [];
  for (const it of list || []) {
    const href = String(it?.href || '');
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push({ href, label: it?.label || href });
  }
  return out.sort((a, b) => a.href.localeCompare(b.href));
};

const defaultRow = () => ({ view: false, create: false, edit: false, delete: false });

const RolePermissionsManager = ({ roleId }) => {
  const navigate = useNavigate();

  const canView = useMemo(() => canPortal('/portal/roles', 'view'), []);
  const canEdit = useMemo(() => canPortal('/portal/roles', 'edit'), []);

  const links = useMemo(() => {
    const raw = uniqByHref(flattenPortalLinks(menuItemsData));
    return raw.filter(l => l.href !== '/portal/logout');
  }, []);

  const [role, setRole] = useState(null);
  const [map, setMap] = useState({});
  const [idMap, setIdMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    if (!roleId) return;
    setIsLoading(true);
    setError('');
    try {
      const roleData = await apiJson(`/portal-roles/${roleId}/`);
      setRole(roleData);

      const data = await apiJson(`/portal-role-permissions/?role=${encodeURIComponent(roleId)}&page=1`);
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      const nextMap = {};
      const nextIdMap = {};
      for (const p of results) {
        const path = String(p?.path || '');
        if (!path) continue;
        nextIdMap[path] = p.id;
        nextMap[path] = {
          view: Boolean(p.can_view),
          create: Boolean(p.can_create),
          edit: Boolean(p.can_edit),
          delete: Boolean(p.can_delete),
        };
      }
      setMap(nextMap);
      setIdMap(nextIdMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load role permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [roleId]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const setCell = (path, key, value) => {
    setMap(prev => ({
      ...prev,
      [path]: {
        ...(prev[path] || defaultRow()),
        [key]: Boolean(value),
      },
    }));
  };

  const save = async () => {
    setError('');
    if (!canEdit) {
      setError('You do not have permission to edit role permissions.');
      return;
    }
    if (!roleId) return;
    setIsSaving(true);
    try {
      for (const link of links) {
        const path = link.href;
        const row = map[path] || defaultRow();
        const hasAny = row.view || row.create || row.edit || row.delete;
        const existingId = idMap[path];

        if (hasAny) {
          const payload = {
            role: Number(roleId),
            path,
            can_view: Boolean(row.view),
            can_create: Boolean(row.create),
            can_edit: Boolean(row.edit),
            can_delete: Boolean(row.delete),
          };
          if (existingId) {
            await apiJson(`/portal-role-permissions/${existingId}/`, { method: 'PATCH', body: payload });
          } else {
            const created = await apiJson('/portal-role-permissions/', { method: 'POST', body: payload });
            setIdMap(prev => ({ ...prev, [path]: created?.id }));
          }
        } else if (existingId) {
          await apiJson(`/portal-role-permissions/${existingId}/`, { method: 'DELETE' });
          setIdMap(prev => {
            const next = { ...prev };
            delete next[path];
            return next;
          });
        }
      }
      setFlash('Permissions saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save permissions.');
    } finally {
      setIsSaving(false);
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
        <div className="card-header flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={() => navigate('/portal/roles')}>
              <LuArrowLeft className="inline size-4" /> Back
            </button>
            <h6 className="card-title">Permissions{role?.name ? `: ${role.name}` : ''}</h6>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={load} disabled={isLoading}>
              <LuRefreshCcw className="inline size-4" /> Refresh
            </button>
            <button type="button" className="btn btn-sm bg-primary text-white" onClick={save} disabled={isSaving || !canEdit}>
              <LuSave className="inline size-4" /> {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="p-5">
          {error ? <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div> : null}

          <div className="rounded-md border border-default-200 bg-default-50 px-4 py-3 text-sm text-default-700">
            Tip: If <b>View</b> is unchecked, the link will be hidden from sidebar and access will be blocked.
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-default-200">
              <thead className="bg-default-100 font-normal whitespace-nowrap">
                <tr className="text-sm text-default-800">
                  <th className="px-3.5 py-3 font-medium text-start">Link</th>
                  <th className="px-3.5 py-3 font-medium text-start">View</th>
                  <th className="px-3.5 py-3 font-medium text-start">Create</th>
                  <th className="px-3.5 py-3 font-medium text-start">Edit</th>
                  <th className="px-3.5 py-3 font-medium text-start">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default-200">
                {links.map(l => {
                  const row = map[l.href] || defaultRow();
                  return (
                    <tr key={l.href} className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-3 text-sm">
                        <div className="font-medium">{l.label}</div>
                        <div className="text-xs text-default-500">{l.href}</div>
                      </td>
                      {['view', 'create', 'edit', 'delete'].map(k => (
                        <td key={k} className="px-3.5 py-3 text-sm">
                          <input
                            type="checkbox"
                            className="form-checkbox rounded-full"
                            checked={Boolean(row[k])}
                            onChange={e => setCell(l.href, k, e.target.checked)}
                            disabled={!canEdit}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-default-500">
            Assign a role to a user from Django Admin: <Link to="/admin/users/user/" target="_blank" rel="noreferrer" className="text-primary underline">Users</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolePermissionsManager;
