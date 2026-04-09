import { Navigate, useParams } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import SyllabusDetailPage from '../components/SyllabusDetailPage';

const PortalSyllabusDetail = () => {
  const params = useParams();
  const syllabusId = params?.id || '';

  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Syllabus Details" />
      <main>
        <PageBreadcrumb title="Syllabus Details" subtitle="Educational" />
        <SyllabusDetailPage syllabusId={syllabusId} />
      </main>
    </>
  );
};

export default PortalSyllabusDetail;

