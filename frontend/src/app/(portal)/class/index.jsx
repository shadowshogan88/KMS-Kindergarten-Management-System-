import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';
import { Navigate } from 'react-router';

import ClassTable from './components/ClassTable';

const PortalClass = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Classes" />
      <main>
        <PageBreadcrumb title="Classes" subtitle="Academics" />
        <ClassTable />
      </main>
    </>
  );
};

export default PortalClass;

