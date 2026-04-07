import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import ClassRoutineViewer from './components/ClassRoutineViewer';

const PortalClassRoutine = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Class Routine" />
      <main>
        <PageBreadcrumb title="Class Routine" subtitle="Academics" />
        <ClassRoutineViewer />
      </main>
    </>
  );
};

export default PortalClassRoutine;

