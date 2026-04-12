import { Link, useLocation } from 'react-router';
import SimplebarClient from '@/components/client-wrapper/SimplebarClient';
import AppMenu from './AppMenu';
import HoverToggle from './HoverToggle';
import logoDark from '@/assets/images/logo-dark.png';
import logoLight from '@/assets/images/logo-light.png';
import logoSm from '@/assets/images/logo-sm.png';
const Sidebar = () => {
  const location = useLocation();
  const pathname = location?.pathname || '';
  const homeHref = pathname.startsWith('/portal/') ? '/portal/dashboard' : '/index';
  return <aside id="app-menu" className="app-menu">
      <Link to={homeHref} className="logo-box sticky top-0 flex min-h-topbar-height items-center justify-start px-6 backdrop-blur-xs">
        <div className="logo-light">
          <img src={logoLight} className="logo-lg h-12 w-auto max-w-[220px] object-contain" alt="Light logo" />
          <img src={logoSm} className="logo-sm h-9 w-9 object-contain" alt="Small logo" />
        </div>

        <div className="logo-dark">
          <img src={logoDark} className="logo-lg h-12 w-auto max-w-[220px] object-contain" alt="Dark logo" />
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
