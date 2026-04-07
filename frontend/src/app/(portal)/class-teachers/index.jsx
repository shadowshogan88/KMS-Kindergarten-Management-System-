import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import ClassTeacherTable from './components/ClassTeacherTable';

const PortalClassTeachers = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Class Teachers" />
      <main>
        <PageBreadcrumb title="Class Teachers" subtitle="Academics" />
        <ClassTeacherTable />
      </main>
    </>
  );
};

export default PortalClassTeachers;

