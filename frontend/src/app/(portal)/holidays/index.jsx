import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import DateHolidaysManager from './components/DateHolidaysManager';

const PortalHolidays = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
        <PageMeta title="Holidays" />
      <main>
        <PageBreadcrumb title="Holidays" subtitle="Academics" />
        <DateHolidaysManager />
      </main>
    </>
  );
};

export default PortalHolidays;
