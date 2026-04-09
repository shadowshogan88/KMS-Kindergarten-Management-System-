import { useEffect, useMemo, useState } from 'react';
import { LuPin, LuPinOff, LuPlus, LuRefreshCcw, LuTrash2 } from 'react-icons/lu';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Bold,
  Italic,
  Underline,
  Link,
  List,
  Heading,
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';

import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';
import { canPortal } from '@/utils/portalPermissions';

const sortNotices = list => {
  const arr = Array.isArray(list) ? list.slice() : [];
  return arr.sort((a, b) => {
    const ap = Boolean(a?.is_pinned);
    const bp = Boolean(b?.is_pinned);
    if (ap !== bp) return ap ? -1 : 1;
    return String(b?.pinned_at || b?.created_at || '').localeCompare(String(a?.pinned_at || a?.created_at || ''));
  });
};

const NoticesManager = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const canView = useMemo(() => canPortal('/portal/notices', 'view'), []);
  const canCreate = useMemo(() => canPortal('/portal/notices', 'create'), []);
  const canEdit = useMemo(() => canPortal('/portal/notices', 'edit'), []);
  const canDelete = useMemo(() => canPortal('/portal/notices', 'delete'), []);

  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    const canUseApi = Boolean(authStorage.getAccess());
    if (!canUseApi) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await apiJson('/notices/?page=1');
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setItems(sortNotices(results));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notices.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const submit = async () => {
    setError('');
    if (!canCreate) {
      setError('You do not have permission to create notices.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        content_html: contentHtml || '',
        is_active: Boolean(isActive),
      };

      const created = await apiJson('/notices/', { method: 'POST', body: payload });
      setItems(prev => sortNotices([created, ...(Array.isArray(prev) ? prev : [])]));
      setTitle('');
      setContentHtml('');
      setIsPinned(false);
      setIsActive(true);
      setFlash('Notice created.');

      if (isPinned && created?.id) {
        const pinned = await apiJson(`/notices/${created.id}/pin/`, { method: 'POST', body: { is_pinned: true } });
        setItems(prev => sortNotices(prev.map(n => (n.id === pinned.id ? pinned : n))));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create notice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePin = async notice => {
    if (!notice?.id) return;
    if (!canEdit) {
      setFlash('No permission to pin/unpin.');
      return;
    }
    try {
      const next = await apiJson(`/notices/${notice.id}/pin/`, { method: 'POST', body: { is_pinned: !notice.is_pinned } });
      setItems(prev => sortNotices(prev.map(n => (n.id === next.id ? next : n))));
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'Failed to update pin.');
    }
  };

  const remove = async notice => {
    if (!notice?.id) return;
    if (!canDelete) {
      setFlash('No permission to delete.');
      return;
    }
    if (!confirm('Delete this notice?')) return;
    try {
      await apiJson(`/notices/${notice.id}/`, { method: 'DELETE' });
      setItems(prev => (Array.isArray(prev) ? prev.filter(n => n.id !== notice.id) : []));
      setFlash('Notice deleted.');
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'Failed to delete notice.');
    }
  };

  if (!canView) {
    return <div className="p-5 text-sm text-danger">You do not have permission to view notices.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {flash ? (
        <div className="px-5">
          <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-default-800">{flash}</div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h6 className="card-title">Create Notice</h6>
          <button type="button" className="btn btn-sm bg-default-200 hover:bg-default-300 text-default-700" onClick={load} disabled={isLoading}>
            <LuRefreshCcw className="inline size-4" /> Refresh
          </button>
        </div>
        <div className="p-5">
          {error ? (
            <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="lg:col-span-2">
              <label className="inline-block mb-2 text-base font-medium">Title</label>
              <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} disabled={isSubmitting || !canCreate} />
            </div>
            <div className="flex items-center gap-2">
              <input id="notice-active" className="form-checkbox rounded" type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} disabled={isSubmitting || !canCreate} />
              <label htmlFor="notice-active" className="text-sm text-default-700">Active</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="notice-pinned" className="form-checkbox rounded" type="checkbox" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} disabled={isSubmitting || !canCreate} />
              <label htmlFor="notice-pinned" className="text-sm text-default-700">Pin this notice</label>
            </div>
          </div>

          <div className="mt-4">
            <label className="inline-block mb-2 text-base font-medium">Content</label>
            <div className={`rounded-md border border-default-200 ${!canCreate ? 'opacity-60' : ''}`}>
              <CKEditor
                editor={ClassicEditor}
                data={contentHtml}
                disabled={isSubmitting || !canCreate}
                config={{
                  plugins: [Essentials, Paragraph, Bold, Italic, Underline, Link, List, Heading],
                  toolbar: ['heading', '|', 'bold', 'italic', 'underline', '|', 'bulletedList', 'numberedList', '|', 'link', '|', 'undo', 'redo'],
                }}
                onChange={(_, editor) => {
                  const data = editor.getData();
                  setContentHtml(data);
                }}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button type="button" className="btn bg-primary text-white flex items-center gap-2" onClick={submit} disabled={isSubmitting || !canCreate}>
              <LuPlus className="size-4" /> {isSubmitting ? 'Saving...' : 'Create Notice'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h6 className="card-title">Notices</h6>
        </div>
        <div className="p-5">
          {isLoading ? <div className="text-sm text-default-500">Loading...</div> : null}
          {!isLoading && !items.length ? <div className="text-sm text-default-500">No notices found.</div> : null}

          {items.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-default-200">
                <thead className="bg-default-100 font-normal whitespace-nowrap">
                  <tr className="text-sm text-default-800">
                    <th className="px-3.5 py-3 font-medium text-start">Pinned</th>
                    <th className="px-3.5 py-3 font-medium text-start">Title</th>
                    <th className="px-3.5 py-3 font-medium text-start">Active</th>
                    <th className="px-3.5 py-3 font-medium text-start">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {items.map(n => (
                    <tr key={n.id} className="text-default-800 font-normal whitespace-nowrap">
                      <td className="px-3.5 py-3 text-sm">
                        <button
                          type="button"
                          className="btn size-8 bg-default-200 hover:bg-warning/10 hover:text-warning text-default-600"
                          title={n.is_pinned ? 'Unpin' : 'Pin'}
                          onClick={() => togglePin(n)}
                          disabled={!canEdit}
                        >
                          {n.is_pinned ? <LuPinOff className="size-4" /> : <LuPin className="size-4" />}
                        </button>
                      </td>
                      <td className="px-3.5 py-3 text-sm">{n.title}</td>
                      <td className="px-3.5 py-3 text-sm">{n.is_active ? 'Yes' : 'No'}</td>
                      <td className="px-3.5 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn size-8 bg-default-200 hover:bg-danger/10 hover:text-danger text-default-600"
                            title="Delete"
                            onClick={() => remove(n)}
                            disabled={!canDelete}
                          >
                            <LuTrash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default NoticesManager;
