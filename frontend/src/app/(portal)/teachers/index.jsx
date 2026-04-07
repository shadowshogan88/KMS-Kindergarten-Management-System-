import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import SubjectTeacherTable from '../subject-teachers/components/SubjectTeacherTable';

const PortalTeachers = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Teachers" />
      <main>
        <PageBreadcrumb title="Teachers" subtitle="Academics" />
        <SubjectTeacherTable />
      </main>
    </>
  );
};

export default PortalTeachers;

