import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LuDownload, LuExternalLink, LuRefreshCcw } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { canPortal } from '@/utils/portalPermissions';

const audienceLabel = a => {
  if (a === 'TEACHERS') return 'All Teachers';
  if (a === 'PARENTS') return 'All Parents';
  return 'All School';
};

const NoticeDetailPage = ({ noticeId }) => {
  const canView = useMemo(() => canPortal('/portal/notices', 'view'), []);
  const [item, setItem] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const pdfUrl = item?.pdf_file || '';
  const desc = String(item?.description || '').trim();
  const classNames = Array.isArray(item?.school_classes_detail)
    ? item.school_classes_detail.map(x => x?.name).filter(Boolean).join(', ')
    : '';

  const load = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    if (!noticeId) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await apiJson(`/notices/${noticeId}/`);
      setItem(data || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notice.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [noticeId]);

  if (!canView) {
    return <div className="p-5 text-sm text-danger">You do not have permission to view notices.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="card-header flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h6 className="card-title">{item?.title || 'Notice'}</h6>
            <div className="mt-1 text-sm text-default-500">
              {audienceLabel(item?.audience)}
              {classNames ? ` · ${classNames}` : ' · All classes'}
              {item?.created_by_username ? ` · By ${item.created_by_username}` : ''}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/portal/notices" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700">
              Back
            </Link>
            <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={load} disabled={isLoading}>
              <LuRefreshCcw className="inline size-4" /> Refresh
            </button>
            {pdfUrl ? (
              <>
                <a className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" href={pdfUrl} target="_blank" rel="noreferrer">
                  <LuExternalLink className="inline size-4" /> Open
                </a>
                <a className="btn btn-sm bg-primary text-white" href={pdfUrl} download>
                  <LuDownload className="inline size-4" /> Download
                </a>
              </>
            ) : null}
          </div>
        </div>

        <div className="p-5">
          {error ? <div className="mb-4 text-sm text-danger">{error}</div> : null}

          {desc ? (
            <div className="mb-4 rounded-md border border-default-200 bg-default-50 px-4 py-3 text-sm text-default-700">
              {desc}
            </div>
          ) : null}

          {!pdfUrl ? (
            <div className="text-sm text-default-500">No PDF attached.</div>
          ) : (
            <div className="w-full">
              <iframe title="Notice PDF" src={pdfUrl} className="w-full rounded-lg border border-default-200" style={{ height: '80vh' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoticeDetailPage;
