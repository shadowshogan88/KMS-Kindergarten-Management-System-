import { Navigate } from 'react-router';

import { authStorage } from '@/utils/auth';

const PortalSubjectTeachers = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return <Navigate to="/portal/teachers" replace />;
};

export default PortalSubjectTeachers;
