import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import DesignationTable from './components/DesignationTable';

const PortalDesignation = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Designations" />
      <main>
        <PageBreadcrumb title="Designations" subtitle="HR" />
        <DesignationTable />
      </main>
    </>
  );
};

export default PortalDesignation;

