import { Navigate, useParams } from 'react-router';

import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageMeta from '@/components/PageMeta';
import { authStorage } from '@/utils/auth';

import NoticeDetailPage from '../components/NoticeDetailPage';

const PortalNoticeDetail = () => {
  const params = useParams();
  const noticeId = params?.id || '';

  if (!authStorage.getAccess()) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  return (
    <>
      <PageMeta title="Notice Details" />
      <main>
        <PageBreadcrumb title="Notice Details" subtitle="Academics" />
        <NoticeDetailPage noticeId={noticeId} />
      </main>
    </>
  );
};

export default PortalNoticeDetail;

