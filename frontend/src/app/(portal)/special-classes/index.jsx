import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import SpecialClassesCalendar from './components/SpecialClassesCalendar';

const PortalSpecialClasses = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Special Classes" />
      <main>
        <PageBreadcrumb title="Special Classes" subtitle="Educational" />
        <SpecialClassesCalendar />
      </main>
    </>
  );
};

export default PortalSpecialClasses;

