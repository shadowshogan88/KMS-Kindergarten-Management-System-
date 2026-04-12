import { Link, useLocation } from 'react-router';
import SimplebarClient from '@/components/client-wrapper/SimplebarClient';
import AppMenu from './AppMenu';
import HoverToggle from './HoverToggle';
import logoDark from '@/assets/images/logo-dark.png';
import logoLight from '@/assets/images/logo-light.png';
import logoDashboard from '@/assets/images/logo-dashboard.png';
import logoSm from '@/assets/images/logo-sm.png';
const Sidebar = () => {
  const location = useLocation();
  const pathname = location?.pathname || '';
  const homeHref = pathname.startsWith('/portal/') ? '/portal/dashboard' : '/index';
  const isPortalDashboard = pathname === '/portal/dashboard' || pathname.startsWith('/portal/dashboard/');
  const logoLightSrc = isPortalDashboard ? logoDashboard : logoLight;
  const logoDarkSrc = isPortalDashboard ? logoDashboard : logoDark;
  const logoBoxClass = isPortalDashboard ? 'logo-lg h-12 w-full max-w-none object-cover object-top' : 'logo-lg h-12 w-auto max-w-[220px] object-contain';
  const logoWrapClass = isPortalDashboard ? 'flex w-full items-center overflow-hidden rounded' : '';
  return <aside id="app-menu" className="app-menu">
      <Link to={homeHref} className="logo-box sticky top-0 flex min-h-topbar-height items-center justify-start px-6 backdrop-blur-xs">
        <div className={`logo-light ${logoWrapClass}`}>
          <img src={logoLightSrc} className={logoBoxClass} alt="Light logo" />
          <img src={logoSm} className="logo-sm h-9 w-9 object-contain" alt="Small logo" />
        </div>

        <div className={`logo-dark ${logoWrapClass}`}>
          <img src={logoDarkSrc} className={logoBoxClass} alt="Dark logo" />
          <img src={logoSm} className="logo-sm h-9 w-9 object-contain" alt="Small logo" />
        </div>
      </Link>

      <HoverToggle />

      <div className="relative min-h-0 flex-grow">
        <SimplebarClient className="size-full">
          <AppMenu />
        </SimplebarClient>
      </div>
    </aside>;
};
export default Sidebar;
