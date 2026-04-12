import { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import PageMeta from '@/components/PageMeta';
import { authStorage, changePassword, fetchMe } from '@/utils/auth';

const PortalChangePassword = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const accessToken = authStorage.getAccess();
  const user = useMemo(() => authStorage.getUser(), []);

  const message = useMemo(() => {
    const stateMsg = typeof location?.state?.message === 'string' ? location.state.message : '';
    if (stateMsg) return stateMsg;
    if (user?.must_change_password) {
      return 'For security, please change your password after your first login.';
    }
    return 'Update your password to keep your account secure.';
  }, [location?.state?.message, user?.must_change_password]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!accessToken) {
    return <Navigate to="/portal" replace state={{ error: 'Please sign in to continue.' }} />;
  }

  const onSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (confirmPassword && confirmPassword !== newPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({
        accessToken,
        newPassword,
        confirmPassword,
      });

      const refreshed = await fetchMe(accessToken);
      authStorage.setUser(refreshed);

      setSuccess('Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        navigate('/portal/dashboard', { replace: true, state: { welcome: true } });
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta title="Change Password" />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 mt-6">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold text-default-900">Change Password</h4>
              <p className="mt-1 text-sm text-default-600">{message}</p>
              {user?.username ? (
                <p className="mt-2 text-xs text-default-500">
                  Signed in as <span className="font-medium text-default-700">{user.username}</span>
                </p>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6">
            <div className="mb-4">
              <label htmlFor="new-password" className="block font-medium text-default-900 text-sm mb-2">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                className="form-input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting}
                placeholder="Enter a strong password"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="confirm-password" className="block font-medium text-default-900 text-sm mb-2">
                Confirm Password (optional)
              </label>
              <input
                id="confirm-password"
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting}
                placeholder="Re-type password"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button type="submit" className="btn bg-primary text-white" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                className="btn border border-default-200 hover:bg-default-150"
                onClick={() => navigate('/portal/profile')}
                disabled={isSubmitting}
              >
                Go to Profile
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default PortalChangePassword;
