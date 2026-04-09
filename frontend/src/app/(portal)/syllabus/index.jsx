import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import SyllabusManager from './components/SyllabusManager';

const PortalSyllabus = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Syllabus" />
      <main>
        <PageBreadcrumb title="Syllabus" subtitle="Educational" />
        <SyllabusManager />
      </main>
    </>
  );
};

export default PortalSyllabus;

