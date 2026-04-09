import { authStorage } from '@/utils/auth';

const normalizePath = p => {
  if (!p) return '';
  const s = String(p).trim();
  if (!s) return '';
  return s.startsWith('/') ? s : `/${s}`;
};

export const getPortalPermissions = () => {
  const user = authStorage.getUser();
  const perms = user?.portal_permissions;
  return perms && typeof perms === 'object' ? perms : {};
};

export const resolvePermissionPath = pathname => {
  const perms = getPortalPermissions();
  const keys = Object.keys(perms);
  if (!keys.length) return '';

  const path = normalizePath(pathname);
  if (!path) return '';

  if (perms[path]) return path;

  // Try parent prefix match: /portal/roles/3/permissions -> /portal/roles
  const sorted = keys.sort((a, b) => b.length - a.length);
  const match = sorted.find(k => path === k || path.startsWith(`${k}/`));
  return match || '';
};

const hasAnyPermissions = () => Object.keys(getPortalPermissions()).length > 0;

export const canPortal = (pathnameOrHref, action = 'view') => {
  const normalized = normalizePath(pathnameOrHref);
  if (normalized === '/portal/logout' || normalized.startsWith('/portal/logout/')) return true;
  if (normalized === '/portal/dashboard' || normalized.startsWith('/portal/dashboard/')) return true;

  // If no portal role assigned, backend allows everything; keep frontend consistent.
  if (!hasAnyPermissions()) return true;

  const perms = getPortalPermissions();
  const key = resolvePermissionPath(normalized) || normalized;
  const row = perms[key];
  if (!row) return false;

  const a = String(action || 'view').toLowerCase();
  if (a === 'create') return Boolean(row.create);
  if (a === 'edit') return Boolean(row.edit);
  if (a === 'delete') return Boolean(row.delete);
  return Boolean(row.view);
};
