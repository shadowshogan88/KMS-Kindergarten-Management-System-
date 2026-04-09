import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LuDownload, LuExternalLink, LuRefreshCcw } from 'react-icons/lu';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { canPortal } from '@/utils/portalPermissions';

const SyllabusDetailPage = ({ syllabusId }) => {
  const canView = useMemo(() => canPortal('/portal/syllabus', 'view'), []);
  const [item, setItem] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const pdfUrl = item?.pdf_url || '';

  const load = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    if (!syllabusId) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await apiJson(`/syllabus/${syllabusId}/`);
      setItem(data || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load syllabus.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [syllabusId]);

  if (!canView) {
    return <div className="p-5 text-sm text-danger">You do not have permission to view syllabus.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <div className="card-header flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h6 className="card-title">{item?.title || 'Syllabus'}</h6>
            <div className="mt-1 text-sm text-default-500">
              {item?.school_class_name || '-'}
              {item?.section ? ` (${item.section})` : ''}
              {item?.subject_code || item?.subject_name ? ` • ${item.subject_code ? `${item.subject_code} - ` : ''}${item.subject_name || ''}` : ''}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/portal/syllabus" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700">
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

          {!pdfUrl ? (
            <div className="text-sm text-default-500">No PDF attached.</div>
          ) : (
            <div className="w-full">
              <iframe title="Syllabus PDF" src={pdfUrl} className="w-full rounded-lg border border-default-200" style={{ height: '80vh' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyllabusDetailPage;
