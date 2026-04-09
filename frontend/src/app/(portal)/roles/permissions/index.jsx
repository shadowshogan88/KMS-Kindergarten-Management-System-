import { Navigate, useParams } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import RolePermissionsManager from '../components/RolePermissionsManager';

const PortalRolePermissions = () => {
  const params = useParams();
  const roleId = params?.id || '';

  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Role Permissions" />
      <main>
        <PageBreadcrumb title="Role Permissions" subtitle="Settings" />
        <RolePermissionsManager roleId={roleId} />
      </main>
    </>
  );
};

export default PortalRolePermissions;

