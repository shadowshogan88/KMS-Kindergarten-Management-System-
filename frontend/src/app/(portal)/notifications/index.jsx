import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import NotificationsManager from './components/NotificationsManager';

const PortalNotifications = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Notifications" />
      <main>
        <PageBreadcrumb title="Notifications" subtitle="Portal" />
        <NotificationsManager />
      </main>
    </>
  );
};

export default PortalNotifications;

