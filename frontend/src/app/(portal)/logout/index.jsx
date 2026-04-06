import { Navigate } from 'react-router';

import { authStorage } from '@/utils/auth';

const PortalLogout = () => {
  authStorage.clear();

  return (
    <Navigate
      to="/portal"
      replace
      state={{
        message: {
          type: 'info',
          text: 'Signed out successfully.',
        },
      }}
    />
  );
};

export default PortalLogout;

