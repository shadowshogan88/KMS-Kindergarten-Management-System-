import { Navigate } from 'react-router';

import DepartmentPage from '@/app/(admin)/(app)/(hr)/department';
import { authStorage } from '@/utils/auth';

const PortalDepartment = () => {
  const accessToken = authStorage.getAccess();
  if (!accessToken) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return <DepartmentPage />;
};

export default PortalDepartment;

