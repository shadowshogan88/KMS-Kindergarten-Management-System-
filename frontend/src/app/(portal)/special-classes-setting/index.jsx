import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import SpecialClassesCalendar from '../special-classes/components/SpecialClassesCalendar';

const PortalSpecialClassesSetting = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Special Classes Settings" />
      <main>
        <PageBreadcrumb title="Special Classes Settings" subtitle="Live Class" />
        <SpecialClassesCalendar />
      </main>
    </>
  );
};

export default PortalSpecialClassesSetting;

