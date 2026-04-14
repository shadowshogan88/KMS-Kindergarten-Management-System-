import avatar1 from '@/assets/images/user/avatar-1.png';
import { Link } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { TbSearch } from 'react-icons/tb';
import SimpleBar from 'simplebar-react';
import SidenavToggle from './SidenavToggle';
import DigitalClock from './DigitalClock';
import {
  LuBellRing,
  LuBookOpen,
  LuCalendarDays,
  LuClock,
  LuCreditCard,
  LuLogOut,
  LuMegaphone,
  LuMoveRight,
  LuPresentation,
  LuSchool,
  LuUserX
} from 'react-icons/lu';
import { apiJson } from '@/utils/api';
import { authStorage } from '@/utils/auth';

const tabs = [{
  id: 'all',
  title: 'All',
  types: []
}, {
  id: 'homework',
  title: 'Homework',
  types: ['HOMEWORK_ASSIGNED']
}, {
  id: 'exam',
  title: 'Exam',
  types: ['EXAM_SCHEDULE_PUBLISHED', 'EXAM_REMINDER', 'RESULT_PUBLISHED']
}, {
  id: 'fees',
  title: 'Fees',
  types: ['FEE_DUE_REMINDER']
}, {
  id: 'attendance',
  title: 'Attendance',
  types: ['ATTENDANCE_ABSENT_ALERT']
}, {
  id: 'notices',
  title: 'Notices',
  types: ['HOLIDAY_NOTICE', 'SCHOOL_ANNOUNCEMENT', 'ADMIN_BROADCAST']
}, {
  id: 'live',
  title: 'Live',
  types: ['LIVE_CLASS_REMINDER']
}];

const isExternalUrl = url => /^https?:\/\//i.test(url || '');

const formatWhen = iso => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return '';
  }
};

const formatAgo = iso => {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diffMs / 1000));
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day`;
  const w = Math.floor(d / 7);
  return `${w} wk`;
};

const typeMeta = type => {
  switch (type) {
    case 'HOMEWORK_ASSIGNED':
      return { icon: <LuBookOpen className="size-5 text-blue-600" />, bg: 'bg-blue-50' };
    case 'EXAM_SCHEDULE_PUBLISHED':
    case 'EXAM_REMINDER':
    case 'RESULT_PUBLISHED':
      return { icon: <LuCalendarDays className="size-5 text-purple-600" />, bg: 'bg-purple-50' };
    case 'FEE_DUE_REMINDER':
      return { icon: <LuCreditCard className="size-5 text-amber-600" />, bg: 'bg-amber-50' };
    case 'ATTENDANCE_ABSENT_ALERT':
      return { icon: <LuUserX className="size-5 text-rose-600" />, bg: 'bg-rose-50' };
    case 'HOLIDAY_NOTICE':
      return { icon: <LuSchool className="size-5 text-emerald-600" />, bg: 'bg-emerald-50' };
    case 'LIVE_CLASS_REMINDER':
      return { icon: <LuPresentation className="size-5 text-cyan-600" />, bg: 'bg-cyan-50' };
    case 'ADMIN_BROADCAST':
    case 'SCHOOL_ANNOUNCEMENT':
      return { icon: <LuMegaphone className="size-5 text-slate-700" />, bg: 'bg-default-100' };
    default:
      return { icon: <LuBellRing className="size-5 text-default-700" />, bg: 'bg-default-100' };
  }
};
const profileMenu = [{
  icon: <LuLogOut className="size-4" />,
  label: 'Sign Out',
  to: '/portal/logout'
}];
const Topbar = () => {
  const [user, setUser] = useState(() => authStorage.getUser());
  const fullName = useMemo(() => {
    const first = (user?.first_name || '').trim();
    const last = (user?.last_name || '').trim();
    const combined = `${first} ${last}`.trim();
    return combined || user?.username || 'User';
  }, [user?.first_name, user?.last_name, user?.username]);
  const userType = useMemo(() => (user?.role || user?.portal_role_name || 'User'), [user?.portal_role_name, user?.role]);
  const userAvatar = useMemo(() => user?.profile_picture_url || avatar1, [user?.profile_picture_url]);

  useEffect(() => {
    const refreshUser = () => setUser(authStorage.getUser());
    window.addEventListener('storage', refreshUser);
    window.addEventListener('kms_user_updated', refreshUser);
    return () => {
      window.removeEventListener('storage', refreshUser);
      window.removeEventListener('kms_user_updated', refreshUser);
    };
  }, []);

  const [activeTab, setActiveTab] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const activeTypes = useMemo(() => {
    const t = tabs.find(x => x.id === activeTab);
    return t?.types || [];
  }, [activeTab]);

  const visibleItems = useMemo(() => {
    if (!activeTypes.length) return allItems;
    return allItems.filter(n => activeTypes.includes(n.type));
  }, [allItems, activeTypes]);

  const loadSummary = async () => {
    try {
      const data = await apiJson('/inbox-notifications/summary/');
      setUnreadCount(data?.unread || 0);
    } catch {
      setUnreadCount(0);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await apiJson('/inbox-notifications/');
      setAllItems(Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []);
    } catch {
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async receiptId => {
    try {
      const updated = await apiJson(`/inbox-notifications/${encodeURIComponent(receiptId)}/read/`, {
        method: 'POST'
      });
      setAllItems(prev => prev.map(x => x.id === receiptId ? updated : x));
      window.dispatchEvent(new CustomEvent('kms_notifications_changed'));
      loadSummary();
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await apiJson('/inbox-notifications/read-all/', {
        method: 'POST'
      });
      window.dispatchEvent(new CustomEvent('kms_notifications_changed'));
      loadItems();
      loadSummary();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSummary();
    loadItems();
    const handleNotificationsChanged = () => {
      loadSummary();
      loadItems();
    };
    window.addEventListener('kms_notifications_changed', handleNotificationsChanged);
    const t = setInterval(() => {
      loadSummary();
      loadItems();
    }, 30000);
    return () => {
      window.removeEventListener('kms_notifications_changed', handleNotificationsChanged);
      clearInterval(t);
    };
  }, []);

  return <div className="app-header min-h-topbar-height flex items-center sticky top-0 z-30 bg-(--topbar-background) border-b border-default-200">
      <div className="w-full flex items-center justify-between px-6">
        <div className="flex items-center gap-5">
          <SidenavToggle />

          <div className="lg:flex hidden items-center relative">
            <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
              <TbSearch className="text-base" />
            </div>
            <input type="search" id="topbar-search" className="form-input px-12 text-sm rounded border-transparent focus:border-transparent w-60" placeholder="Search something..." />
            <button type="button" className="absolute inset-y-0 end-0 flex items-center pe-4">
              <span className="ms-auto font-medium">⌘ K</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <DigitalClock />
          <div className="topbar-item hs-dropdown [--auto-close:inside] relative inline-flex">
            <button type="button" className="hs-dropdown-toggle btn btn-icon size-8 hover:bg-default-150 rounded-full relative">
              <LuBellRing className="size-4.5" />
              {unreadCount > 0 && <span className="absolute end-0 top-0 size-1.5 bg-primary/90 rounded-full"></span>}
            </button>
            <div className="hs-dropdown-menu max-w-100 p-0">
              <div className="p-4 border-b border-default-200 flex items-center gap-2">
                <h3 className="text-base text-default-800">Notifications</h3>
                {unreadCount > 0 && <span className="size-5 font-semibold bg-orange-500 rounded text-white flex items-center justify-center text-xs">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>}
              </div>

              <nav className="flex gap-x-1 bg-default-150 p-2 border-b border-default-200 overflow-x-auto" role="tablist">
                {tabs.map((tab, i) => <button key={i} type="button" onClick={() => setActiveTab(tab.id)} className={`py-0.5 px-4 rounded font-semibold inline-flex items-center gap-x-2 border-b-2 border-transparent text-xs whitespace-nowrap ${activeTab === tab.id ? 'bg-card text-primary' : 'text-default-500 hover:text-blue-600'}`}>
                    {tab.title}
                  </button>)}
              </nav>

              <SimpleBar className="h-80">
                {loading ? <div className="p-4 text-sm text-default-500">Loading...</div> : visibleItems.length === 0 ? <div className="p-4 text-sm text-default-500">No notifications</div> : visibleItems.map(n => {
                  const meta = typeMeta(n.type);
                  const title = n.title || n.message || 'Notification';
                  const href = n.action_url || '#!';
                  const content = <>
                        <div className={`size-10 rounded-md ${meta.bg} flex justify-center items-center`}>
                          {meta.icon}
                        </div>
                        <div className="flex justify-between w-full text-sm">
                          <div>
                            <h6 className={`mb-2 font-medium ${n.is_read ? 'text-default-600' : 'text-default-800'}`}>{title}</h6>
                            <p className="flex items-center gap-1 text-default-500 text-xs">
                              <LuClock className="size-3.5" /> <span>{formatWhen(n.created_at)}</span>
                            </p>
                            {n.message && n.message !== n.title && <p className="p-2 bg-default-50 text-default-500 mt-2 rounded line-clamp-2">
                                {n.message}
                              </p>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-default-500">
                            {!n.is_read && <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>}
                            {formatAgo(n.created_at)}
                          </div>
                        </div>
                      </>;

                  if (href && href !== '#!' && !isExternalUrl(href)) {
                    return <Link key={n.id} to={href} onClick={() => markRead(n.id)} className="flex gap-3 p-4 items-start hover:bg-default-150">
                        {content}
                      </Link>;
                  }

                  return <a key={n.id} href={href || '#!'} target={isExternalUrl(href) ? '_blank' : undefined} rel={isExternalUrl(href) ? 'noreferrer' : undefined} onClick={() => markRead(n.id)} className="flex gap-3 p-4 items-start hover:bg-default-150">
                      {content}
                    </a>;
                })}
              </SimpleBar>

              <div className="flex items-center justify-between p-4 border-t border-default-200">
                <button type="button" onClick={markAllRead} className="text-sm font-medium text-default-900 hover:text-primary">
                  Mark all read
                </button>
                <Link to="/portal/notifications" className="btn btn-sm text-white bg-primary inline-flex items-center gap-2">
                  View All <LuMoveRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="topbar-item hs-dropdown relative inline-flex">
            <button className="cursor-pointer bg-pink-100 rounded-full">
              <img src={userAvatar} alt="user" className="hs-dropdown-toggle rounded-full size-9.5 object-cover" />
            </button>
            <div className="hs-dropdown-menu min-w-48">
              <div className="p-2">
                <h6 className="mb-2 text-default-500">Welcome to TinyTrack</h6>
                <a className="flex gap-3" href="/portal/profile" data-discover="true">
                  <div className="relative inline-block">
                    <img alt="user" className="size-12 rounded object-cover" src={userAvatar} />
                    <span className="-top-1 -end-1 absolute w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full"></span>
                  </div>
                  <div>
                    <h6 className="mb-1 text-sm font-semibold text-default-800">{fullName}</h6>
                    <p className="text-default-500">{userType}</p>
                  </div>
                </a>
              </div>

              <div className="border-t border-default-200 -mx-2 my-2"></div>

              <div className="flex flex-col gap-y-1">
                {profileMenu.map((item, i) => item.divider ? <div key={i} className="border-t border-default-200 -mx-2 my-1"></div> : <Link key={i} to={item.to || '#!'} className="flex items-center gap-x-3.5 py-1.5 px-3 text-default-600 hover:bg-default-150 rounded font-medium">
                      {item.icon}
                      {item.label}
                      {item.badge && <span className="size-4.5 font-semibold bg-danger rounded text-white flex items-center justify-center text-xs">
                          {item.badge}
                        </span>}
                    </Link>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default Topbar;
