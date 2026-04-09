import { useLocation, Link } from 'react-router-dom';

import Footer from '@/components/layouts/Footer';
import Sidebar from '@/components/layouts/SideNav';
import Topbar from '@/components/layouts/topbar';
import { canPortal } from '@/utils/portalPermissions';
const PageWrapper = ({
  children
}) => {
  const location = useLocation();
  const pathname = location?.pathname || '';
  const needsPortalCheck = pathname.startsWith('/portal/');
  const allowed = !needsPortalCheck || canPortal(pathname, 'view');
  return <>
      <div className="wrapper">
        <Sidebar />
        <div className="page-content">
          <Topbar />
          {allowed ? children : <div className="p-6">
              <div className="rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                <div className="font-semibold">Access denied</div>
                <div className="mt-1">You don't have permission to view this page.</div>
                <div className="mt-2">
                  <Link to="/portal/dashboard" className="text-primary underline">Go to dashboard</Link>
                </div>
              </div>
            </div>}
          <Footer />
        </div>
      </div>
    </>;
};
export default PageWrapper;
