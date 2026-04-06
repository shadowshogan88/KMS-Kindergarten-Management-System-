import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import ClassroomTable from './components/ClassroomTable';

const PortalClassroom = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Classrooms" />
      <main>
        <PageBreadcrumb title="Classrooms" subtitle="Academics" />
        <ClassroomTable />
      </main>
    </>
  );
};

export default PortalClassroom;

