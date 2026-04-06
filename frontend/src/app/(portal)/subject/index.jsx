import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import SubjectTable from './components/SubjectTable';

const PortalSubject = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Subjects" />
      <main>
        <PageBreadcrumb title="Subjects" subtitle="Academics" />
        <SubjectTable />
      </main>
    </>
  );
};

export default PortalSubject;

