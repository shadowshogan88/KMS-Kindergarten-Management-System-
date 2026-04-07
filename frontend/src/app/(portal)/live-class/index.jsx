import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import LiveClassSettings from './components/LiveClassSettings';

const PortalLiveClass = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Live Class" />
      <main>
        <PageBreadcrumb title="Live Class" subtitle="Academics" />
        <LiveClassSettings />
      </main>
    </>
  );
};

export default PortalLiveClass;

