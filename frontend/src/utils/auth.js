import { API_BASE_PATH } from '@/helpers/constants';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const normalizeBaseUrl = baseUrl => {
  if (!baseUrl) return '';
  return String(baseUrl).replace(/\/+$/, '');
};

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  return normalizeBaseUrl(envUrl || API_BASE_PATH || DEFAULT_API_BASE_URL);
};

export const authStorage = {
  getAccess() {
    return sessionStorage.getItem('kms_access_token') || localStorage.getItem('kms_access_token') || '';
  },
  getRefresh() {
    return sessionStorage.getItem('kms_refresh_token') || localStorage.getItem('kms_refresh_token') || '';
  },
  isTemp() {
    return Boolean(sessionStorage.getItem('kms_access_token'));
  },
  getUser() {
    const raw = sessionStorage.getItem('kms_user') || localStorage.getItem('kms_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setSession({ access, refresh, user }) {
    if (access) localStorage.setItem('kms_access_token', access);
    if (refresh) localStorage.setItem('kms_refresh_token', refresh);
    if (user) localStorage.setItem('kms_user', JSON.stringify(user));
  },
  setSessionTemp({ access, refresh, user }) {
    if (access) sessionStorage.setItem('kms_access_token', access);
    if (refresh) sessionStorage.setItem('kms_refresh_token', refresh);
    if (user) sessionStorage.setItem('kms_user', JSON.stringify(user));
  },
  setAccess(access) {
    if (!access) return;
    if (this.isTemp()) sessionStorage.setItem('kms_access_token', access);
    else localStorage.setItem('kms_access_token', access);
  },
  clear() {
    sessionStorage.removeItem('kms_access_token');
    sessionStorage.removeItem('kms_refresh_token');
    sessionStorage.removeItem('kms_user');
    localStorage.removeItem('kms_access_token');
    localStorage.removeItem('kms_refresh_token');
    localStorage.removeItem('kms_user');
  },
};

export const tokenLogin = async ({ username, password }) => {
  const res = await fetch(`${getApiBaseUrl()}/auth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.detail ||
      (typeof data === 'string' ? data : '') ||
      `Login failed (HTTP ${res.status})`;
    throw new Error(message);
  }

  return { access: data.access, refresh: data.refresh };
};

export const fetchMe = async accessToken => {
  const res = await fetch(`${getApiBaseUrl()}/auth/me/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.detail ||
      (typeof data === 'string' ? data : '') ||
      `Failed to fetch user (HTTP ${res.status})`;
    throw new Error(message);
  }

  return data;
};

export const refreshAccess = async refreshToken => {
  const res = await fetch(`${getApiBaseUrl()}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.detail ||
      (typeof data === 'string' ? data : '') ||
      `Refresh failed (HTTP ${res.status})`;
    throw new Error(message);
  }

  return { access: data.access };
};
