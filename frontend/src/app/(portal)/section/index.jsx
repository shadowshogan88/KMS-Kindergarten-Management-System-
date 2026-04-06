import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import SectionTable from './components/SectionTable';

const PortalSection = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Sections" />
      <main>
        <PageBreadcrumb title="Sections" subtitle="Academics" />
        <SectionTable />
      </main>
    </>
  );
};

export default PortalSection;

