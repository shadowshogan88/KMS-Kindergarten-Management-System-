import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import SubjectTeacherTable from './components/SubjectTeacherTable';

const PortalSubjectTeachers = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Subject Teachers" />
      <main>
        <PageBreadcrumb title="Subject Teachers" subtitle="Academics" />
        <SubjectTeacherTable />
      </main>
    </>
  );
};

export default PortalSubjectTeachers;

