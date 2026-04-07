import { Navigate } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import WeeklyHolidaysManager from './components/WeeklyHolidaysManager';

const PortalWeeklyHolidays = () => {
  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Weekly Holidays" />
      <main>
        <PageBreadcrumb title="Weekly Holidays" subtitle="Academics" />
        <WeeklyHolidaysManager />
      </main>
    </>
  );
};

export default PortalWeeklyHolidays;

