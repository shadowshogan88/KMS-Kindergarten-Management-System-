import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import HrDashboard from '@/app/(admin)/(dashboards)/hr';
import { authStorage } from '@/utils/auth';

const PortalDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const accessToken = authStorage.getAccess();
  const user = useMemo(() => authStorage.getUser(), []);
  const [showWelcome, setShowWelcome] = useState(() => Boolean(location?.state?.welcome));

  if (!accessToken) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  const displayName =
    user?.name ||
    `${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
    user?.username ||
    '';

  useEffect(() => {
    if (!showWelcome) return;
    const timer = setTimeout(() => setShowWelcome(false), 5000);
    return () => clearTimeout(timer);
  }, [showWelcome]);

  useEffect(() => {
    if (!location?.state?.welcome) return;
    navigate(location.pathname, { replace: true, state: {} });
  }, [location?.state?.welcome, location.pathname, navigate]);

  return (
    <>
      {showWelcome ? (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-5">
          <div className="relative rounded-md border border-primary/20 bg-primary/10 px-4 py-3 pr-11 text-sm text-default-800">
            <span className="font-medium">Welcome{displayName ? `, ${displayName}` : ''}!</span> You’re signed in successfully.
            <button
              type="button"
              onClick={() => setShowWelcome(false)}
              className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-default-700 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close message"
            >
              <span aria-hidden="true" className="text-base leading-none">
                ×
              </span>
            </button>
          </div>
        </div>
      ) : null}
      <HrDashboard />
    </>
  );
};

export default PortalDashboard;
