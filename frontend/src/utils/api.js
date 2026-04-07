import { authStorage, getApiBaseUrl, refreshAccess } from '@/utils/auth';

const parseErrorMessage = (data, res) => {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const fieldErrorKeys = ['detail', 'message', 'non_field_errors'];
    for (const k of fieldErrorKeys) {
      const v = data[k];
      if (typeof v === 'string' && v) return v;
      if (Array.isArray(v) && v.length && typeof v[0] === 'string') return v[0];
    }
    const firstKey = Object.keys(data)[0];
    const firstVal = firstKey ? data[firstKey] : null;
    if (Array.isArray(firstVal) && firstVal.length && typeof firstVal[0] === 'string') return firstVal[0];
  }
  return (
    data?.detail ||
    data?.message ||
    (typeof data === 'string' ? data : '') ||
    `Request failed (HTTP ${res.status})`
  );
};

const shouldTryRefresh = (res, data) => {
  if (res.status !== 401) return false;
  const code = data?.code;
  const detail = data?.detail;
  return code === 'token_not_valid' || detail === 'Given token not valid for any token type';
};

export const apiJson = async (path, { method = 'GET', body, headers } = {}, _retried = false) => {
  const token = authStorage.getAccess();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;

  if (!_retried && shouldTryRefresh(res, data)) {
    const refresh = authStorage.getRefresh();
    if (refresh) {
      try {
        const next = await refreshAccess(refresh);
        authStorage.setAccess(next.access);
        return apiJson(path, { method, body, headers }, true);
      } catch {
        authStorage.clear();
        throw new Error('Session expired. Please sign in again.');
      }
    } else {
      authStorage.clear();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  throw new Error(parseErrorMessage(data, res));
};
