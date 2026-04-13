import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LuCheckCheck, LuRefreshCw } from 'react-icons/lu';

import { apiJson } from '@/utils/api';

const isExternalUrl = url => /^https?:\/\//i.test(url || '');

const typeOptions = [{
  value: '',
  label: 'All types'
}, {
  value: 'HOMEWORK_ASSIGNED',
  label: 'Homework assigned'
}, {
  value: 'EXAM_SCHEDULE_PUBLISHED',
  label: 'Exam schedule published'
}, {
  value: 'EXAM_REMINDER',
  label: 'Exam reminder'
}, {
  value: 'RESULT_PUBLISHED',
  label: 'Result published'
}, {
  value: 'FEE_DUE_REMINDER',
  label: 'Fee due reminder'
}, {
  value: 'ATTENDANCE_ABSENT_ALERT',
  label: 'Attendance absent alert'
}, {
  value: 'HOLIDAY_NOTICE',
  label: 'Holiday notice'
}, {
  value: 'LIVE_CLASS_REMINDER',
  label: 'Live class reminder'
}, {
  value: 'SCHOOL_ANNOUNCEMENT',
  label: 'School announcement'
}, {
  value: 'ADMIN_BROADCAST',
  label: 'Admin broadcast'
}];

const priorityBadge = p => {
  switch ((p || '').toUpperCase()) {
    case 'URGENT':
      return 'bg-rose-500 text-white';
    case 'HIGH':
      return 'bg-amber-500 text-white';
    case 'LOW':
      return 'bg-default-200 text-default-700';
    default:
      return 'bg-blue-500 text-white';
  }
};

const NotificationsManager = () => {
  const [mode, setMode] = useState('all'); // all | unread
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  const queryPath = useMemo(() => {
    const qs = new URLSearchParams();
    if (mode === 'unread') qs.set('tab', 'unread');
    if (type) qs.set('type', type);
    const suffix = qs.toString();
    return `/inbox-notifications/${suffix ? `?${suffix}` : ''}`;
  }, [mode, type]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiJson(queryPath);
      setItems(Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
      setError(e?.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [queryPath]);

  const markAllRead = async () => {
    try {
      await apiJson('/inbox-notifications/read-all/', { method: 'POST' });
      window.dispatchEvent(new CustomEvent('kms_notifications_changed'));
      load();
    } catch {
      // ignore
    }
  };

  const markRead = async receiptId => {
    try {
      const updated = await apiJson(`/inbox-notifications/${encodeURIComponent(receiptId)}/read/`, { method: 'POST' });
      setItems(prev => prev.map(x => x.id === receiptId ? updated : x));
      window.dispatchEvent(new CustomEvent('kms_notifications_changed'));
    } catch {
      // ignore
    }
  };

  const markUnread = async receiptId => {
    try {
      const updated = await apiJson(`/inbox-notifications/${encodeURIComponent(receiptId)}/unread/`, { method: 'POST' });
      setItems(prev => prev.map(x => x.id === receiptId ? updated : x));
      window.dispatchEvent(new CustomEvent('kms_notifications_changed'));
    } catch {
      // ignore
    }
  };

  return (
    <section className="card">
      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMode('all')} className={`btn btn-sm ${mode === 'all' ? 'bg-primary text-white' : 'bg-default-100 text-default-700'}`}>
              All
            </button>
            <button type="button" onClick={() => setMode('unread')} className={`btn btn-sm ${mode === 'unread' ? 'bg-primary text-white' : 'bg-default-100 text-default-700'}`}>
              Unread
            </button>
            <select className="form-select form-select-sm" value={type} onChange={e => setType(e.target.value)}>
              {typeOptions.map(o => <option key={o.value} value={o.value}>
                  {o.label}
                </option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-sm bg-default-100 text-default-700 inline-flex items-center gap-2" onClick={load} disabled={loading}>
              <LuRefreshCw className="size-4" /> Refresh
            </button>
            <button type="button" className="btn btn-sm bg-primary text-white inline-flex items-center gap-2" onClick={markAllRead}>
              <LuCheckCheck className="size-4" /> Mark all read
            </button>
          </div>
        </div>

        {error && <div className="mt-3 text-sm text-danger">{error}</div>}

        <div className="mt-4 divide-y divide-default-200">
          {loading ? <div className="py-6 text-sm text-default-500">Loading…</div> : items.length === 0 ? <div className="py-6 text-sm text-default-500">No notifications</div> : items.map(n => {
            const href = n.action_url || '#!';
            const title = n.title || n.message || 'Notification';
            const time = n.created_at ? new Date(n.created_at).toLocaleString() : '';

            const row = <div className="py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h6 className={`text-sm font-semibold ${n.is_read ? 'text-default-600' : 'text-default-800'}`}>{title}</h6>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${priorityBadge(n.priority)}`}>
                        {(n.priority || 'NORMAL').toUpperCase()}
                      </span>
                      {!n.is_read && <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">UNREAD</span>}
                    </div>
                    {n.message && n.message !== n.title && <p className="mt-1 text-xs text-default-500 whitespace-pre-wrap">
                        {n.message}
                      </p>}
                    <p className="mt-1 text-[11px] text-default-400">{time}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!n.is_read && <button type="button" className="btn btn-xs bg-default-100 text-default-700" onClick={() => markRead(n.id)}>
                        Mark read
                      </button>}
                    {n.is_read && <button type="button" className="btn btn-xs bg-default-100 text-default-700" onClick={() => markUnread(n.id)}>
                        Mark unread
                      </button>}
                  </div>
                </div>;

            if (href && href !== '#!' && !isExternalUrl(href)) {
              return <Link key={n.id} to={href} onClick={() => markRead(n.id)} className="block hover:bg-default-50 px-2 rounded">
                  {row}
                </Link>;
            }

            return <a key={n.id} href={href} target={isExternalUrl(href) ? '_blank' : undefined} rel={isExternalUrl(href) ? 'noreferrer' : undefined} onClick={() => markRead(n.id)} className="block hover:bg-default-50 px-2 rounded">
                {row}
              </a>;
          })}
        </div>
      </div>
    </section>
  );
};

export default NotificationsManager;
