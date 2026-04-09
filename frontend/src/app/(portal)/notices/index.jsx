import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import NoticesManager from './components/NoticesManager';

const PortalNotices = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Notices" />
      <main>
        <PageBreadcrumb title="Notices" subtitle="Academics" />
        <NoticesManager />
      </main>
    </>
  );
};

export default PortalNotices;
