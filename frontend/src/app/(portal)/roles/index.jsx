import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import RolesManager from './components/RolesManager';

const PortalRoles = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Roles" />
      <main>
        <PageBreadcrumb title="Roles" subtitle="Settings" />
        <RolesManager />
      </main>
    </>
  );
};

export default PortalRoles;

