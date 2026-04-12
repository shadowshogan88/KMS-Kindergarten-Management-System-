import { useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import PageMeta from '@/components/PageMeta';
import { authStorage, fetchMe } from '@/utils/auth';

const PortalProfile = () => {
  const navigate = useNavigate();
  const accessToken = authStorage.getAccess();
  const user = useMemo(() => authStorage.getUser(), []);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [avatar, setAvatar] = useState(() => authStorage.getAvatar() || '/src/assets/images/user/avatar-1.png');
  const avatarInputRef = useRef(null);

  if (!accessToken) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  const onAvatarChange = e => {
    setError('');
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setError('Please choose an image file.');
      if (e?.target) e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Please choose an image smaller than 2MB.');
      if (e?.target) e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      const saved = authStorage.setAvatar(dataUrl);
      if (!saved) {
        setError('Could not save photo (storage limit). Please use a smaller image.');
      } else {
        setAvatar(dataUrl);
      }
      if (e?.target) e.target.value = '';
    };
    reader.onerror = () => {
      setError('Failed to read image.');
      if (e?.target) e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    authStorage.clearAvatar();
    setAvatar('/src/assets/images/user/avatar-1.png');
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const refresh = async () => {
    setError('');
    setIsRefreshing(true);
    try {
      const refreshed = await fetchMe(accessToken);
      authStorage.setUser(refreshed);
      navigate(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh profile.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <PageMeta title="My Profile" />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 mt-6">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold text-default-900">My Profile</h4>
              <p className="mt-1 text-sm text-default-600">Account details for the portal.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn border border-default-200 hover:bg-default-150"
                onClick={refresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <Link to="/portal/change-password" className="btn bg-primary text-white">
                Change Password
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 rounded-md border border-default-200 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <img alt="user" className="size-14 rounded" src={avatar} />
                <div>
                  <div className="text-sm font-semibold text-default-900">Profile Photo</div>
                  <div className="text-xs text-default-500">Upload a new picture (max 2MB).</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="btn bg-primary text-white cursor-pointer" htmlFor="portal-avatar-upload">
                  Upload
                </label>
                <input
                  id="portal-avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={avatarInputRef}
                  onChange={onAvatarChange}
                />
                <button type="button" className="btn border border-default-200 hover:bg-default-150" onClick={removeAvatar}>
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-md border border-default-200 p-4">
              <div className="text-xs text-default-500">Username</div>
              <div className="mt-1 text-sm font-medium text-default-900">{user?.username || '-'}</div>
            </div>
            <div className="rounded-md border border-default-200 p-4">
              <div className="text-xs text-default-500">Role</div>
              <div className="mt-1 text-sm font-medium text-default-900">{user?.role || '-'}</div>
            </div>
            <div className="rounded-md border border-default-200 p-4">
              <div className="text-xs text-default-500">Full Name</div>
              <div className="mt-1 text-sm font-medium text-default-900">
                {`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.name || '-'}
              </div>
            </div>
            <div className="rounded-md border border-default-200 p-4">
              <div className="text-xs text-default-500">Email</div>
              <div className="mt-1 text-sm font-medium text-default-900">{user?.email || '-'}</div>
            </div>
            <div className="rounded-md border border-default-200 p-4">
              <div className="text-xs text-default-500">Phone</div>
              <div className="mt-1 text-sm font-medium text-default-900">{user?.phone || '-'}</div>
            </div>
            <div className="rounded-md border border-default-200 p-4">
              <div className="text-xs text-default-500">Security</div>
              <div className="mt-1 text-sm font-medium text-default-900">
                {user?.must_change_password ? 'Password change recommended' : 'OK'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PortalProfile;
