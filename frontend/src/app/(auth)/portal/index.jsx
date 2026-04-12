import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import logoDark from '@/assets/images/logo-portal-dark.png';
import logoLight from '@/assets/images/logo-light.png';
import PageMeta from '@/components/PageMeta';
import { authStorage, fetchMe, tokenLogin } from '@/utils/auth';

const PortalLogin = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const allowSwitchUser = useMemo(() => {
    const search = location?.search || '';
    return new URLSearchParams(search).get('switch') === '1';
  }, [location?.search]);

  const [hasSession, setHasSession] = useState(() => Boolean(authStorage.getAccess()));
  const existingUser = useMemo(() => authStorage.getUser(), [hasSession]);

  const [message, setMessage] = useState(() => {
    const raw = location?.state?.message;
    if (!raw) return null;
    if (typeof raw === 'string') return { type: 'info', text: raw };
    if (typeof raw === 'object') return { type: raw.type || 'info', text: raw.text || '' };
    return null;
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(() => location?.state?.error || '');

  const onSubmit = async event => {
    event.preventDefault();
    setError('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError('Please enter username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      authStorage.clear();
      const { access, refresh } = await tokenLogin({ username: trimmedUsername, password });
      const user = await fetchMe(access);

      if (remember) authStorage.setSession({ access, refresh, user });
      else authStorage.setSessionTemp({ access, refresh, user });

      setHasSession(true);
      if (user?.must_change_password) {
        navigate('/portal/change-password', {
          replace: true,
          state: { message: 'For security, please change your password after your first login.' },
        });
      } else {
        navigate('/portal/dashboard', { replace: true, state: { welcome: true } });
      }
    } catch (e) {
      authStorage.clear();
      setHasSession(false);
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!message?.text) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!hasSession || allowSwitchUser) return;
    if (existingUser?.must_change_password) {
      navigate('/portal/change-password', { replace: true });
    } else {
      navigate('/portal/dashboard', { replace: true });
    }
  }, [allowSwitchUser, existingUser?.must_change_password, hasSession, navigate]);

  return (
    <>
      <PageMeta title="Portal Login" />
      <div className="relative min-h-screen w-full flex justify-center items-center py-16 md:py-10">
        <div className="card md:w-lg w-screen z-10">
            <div className="text-center px-10 py-12">
              <Link to="/index" className="flex justify-center">
                <img src={logoDark} alt="logo dark" className="h-16 w-auto object-contain flex dark:hidden" />
                <img src={logoLight} alt="logo light" className="h-16 w-auto object-contain hidden dark:flex" />
              </Link>

            <div className="mt-8 text-center">
              <h4 className="mb-2.5 text-xl font-semibold text-primary">Welcome Back !</h4>
              <p className="text-base text-default-500">Sign in to continue to Kindergarten KMS.</p>
            </div>

            <form onSubmit={onSubmit} className="text-left w-full mt-10">
              {message?.text ? (
                <div className="mb-4 relative rounded-md border border-primary/20 bg-primary/10 px-4 py-3 pr-11 text-sm text-default-800">
                  {message.text}
                  <button
                    type="button"
                    onClick={() => setMessage(null)}
                    className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-default-700 hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label="Close message"
                  >
                    <span aria-hidden="true" className="text-base leading-none">
                      ×
                    </span>
                  </button>
                </div>
              ) : null}
              {hasSession ? (
                <div className="mb-4 rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-default-800">
                  <div className="font-medium">You’re already signed in{existingUser?.username ? ` as ${existingUser.username}` : ''}.</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {existingUser?.must_change_password ? (
                        <Link to="/portal/change-password" className="btn bg-primary text-white">
                          Continue to Change Password
                        </Link>
                      ) : (
                        <Link to="/portal/dashboard" className="btn bg-primary text-white">
                          Continue to Dashboard
                        </Link>
                      )}
                      <button
                        type="button"
                        className="btn border border-default-200 hover:bg-default-150"
                        onClick={() => {
                        authStorage.clear();
                        setHasSession(false);
                        setUsername('');
                        setPassword('');
                        setError('');
                      }}
                    >
                      Sign in as different user
                    </button>
                  </div>
                </div>
              ) : null}
              {error ? (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="mb-4">
                <label htmlFor="portal-username" className="block font-medium text-default-900 text-sm mb-2">
                  Username / Email ID
                </label>
                <input
                  type="text"
                  id="portal-username"
                  className="form-input"
                  placeholder="Enter Username or email"
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="mb-4">
                <Link to="/basic-reset-password" className="text-primary font-medium text-sm mb-2 float-end">
                  Forgot Password ?
                </Link>
                <label htmlFor="portal-password" className="block font-medium text-default-900 text-sm mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="portal-password"
                  className="form-input"
                  placeholder="Enter Password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center gap-2 mb-4">
                <input
                  id="portal-remember"
                  type="checkbox"
                  className="form-checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  disabled={isSubmitting}
                />
                <label className="text-default-900 text-sm font-medium" htmlFor="portal-remember">
                  Remember Me
                </label>
              </div>

              <div className="mt-10 text-center">
                <button type="submit" className="btn bg-primary text-white w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing In...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="absolute inset-0 overflow-hidden">
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full fill-black/2 stroke-black/5 dark:fill-white/2.5 dark:stroke-white/2.5"
          >
            <defs>
              <pattern id="authPattern" width="56" height="56" patternUnits="userSpaceOnUse" x="50%" y="16">
                <path d="M.5 56V.5H72" fill="none"></path>
              </pattern>
            </defs>
            <rect width="100%" height="100%" strokeWidth="0" fill="url(#authPattern)"></rect>
          </svg>
        </div>
      </div>
    </>
  );
};

export default PortalLogin;
