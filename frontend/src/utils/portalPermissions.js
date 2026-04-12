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
  const user = authStorage.getUser();
  const userRole = String(user?.role || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || Boolean(user?.is_superuser);

  let normalized = normalizePath(pathnameOrHref);
  if (normalized === '/portal/logout' || normalized.startsWith('/portal/logout/')) return true;
  if (normalized === '/portal/dashboard' || normalized.startsWith('/portal/dashboard/')) return true;
  if (normalized === '/portal/profile' || normalized.startsWith('/portal/profile/')) return true;
  if (normalized === '/portal/change-password' || normalized.startsWith('/portal/change-password/')) return true;

  // Admin-only pages (backend enforces IsAdmin regardless of portal RBAC).
  if (normalized === '/portal/roles' || normalized.startsWith('/portal/roles/')) return isAdmin;
  if (normalized === '/portal/notifications' || normalized.startsWith('/portal/notifications/')) {
    return String(action || 'view').toLowerCase() === 'view';
  }

  // Alias routes to share the same RBAC permission row.
  if (normalized === '/portal/special-classes-setting' || normalized.startsWith('/portal/special-classes-setting/')) {
    normalized = '/portal/special-classes';
  }
  // Staff/HR module routes currently reuse department permission in portal RBAC.
  // This keeps menu + pages accessible even if backend doesn't yet expose separate permission rows.
  if (normalized === '/portal/employee' || normalized.startsWith('/portal/employee/')) normalized = '/portal/department';
  if (normalized === '/portal/staff-holidays' || normalized.startsWith('/portal/staff-holidays/')) normalized = '/portal/department';
  if (normalized === '/portal/leave' || normalized.startsWith('/portal/leave/')) normalized = '/portal/department';
  if (normalized === '/portal/leave-employee' || normalized.startsWith('/portal/leave-employee/')) normalized = '/portal/department';
  if (normalized === '/portal/create-leave' || normalized.startsWith('/portal/create-leave/')) normalized = '/portal/department';
  if (normalized === '/portal/create-leave-employee' || normalized.startsWith('/portal/create-leave-employee/')) normalized = '/portal/department';
  if (normalized === '/portal/staff-attendance' || normalized.startsWith('/portal/staff-attendance/')) normalized = '/portal/department';
  if (normalized === '/portal/staff-attendance-main' || normalized.startsWith('/portal/staff-attendance-main/')) normalized = '/portal/department';
  if (normalized === '/portal/payroll-employee-salary' || normalized.startsWith('/portal/payroll-employee-salary/')) normalized = '/portal/department';
  if (normalized === '/portal/payroll-payslip' || normalized.startsWith('/portal/payroll-payslip/')) normalized = '/portal/department';
  if (normalized === '/portal/create-payslip' || normalized.startsWith('/portal/create-payslip/')) normalized = '/portal/department';
  if (normalized === '/portal/sales-estimates' || normalized.startsWith('/portal/sales-estimates/')) normalized = '/portal/department';
  if (normalized === '/portal/sales-payments' || normalized.startsWith('/portal/sales-payments/')) normalized = '/portal/department';
  if (normalized === '/portal/sales-expenses' || normalized.startsWith('/portal/sales-expenses/')) normalized = '/portal/department';

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
