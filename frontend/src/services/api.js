const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export async function api(path, { method = 'GET', body, token, signal } = {}) {
  const accessToken = token !== undefined ? token : sessionStorage.getItem('bloodline_access_token');
  let response;
  try {
    response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('The service could not be reached. Check that the API is running.', 0);
  }
  let payload;
  try { payload = await response.json(); } catch { payload = {}; }
  if (response.status === 401) window.dispatchEvent(new Event('bloodline:session-expired'));
  if (!response.ok) {
    const message = response.status === 409 && /inventory/i.test(payload.message || '')
      ? 'There is not enough available inventory to complete this request.'
      : payload.message || `The request failed (${response.status}).`;
    throw new ApiError(message, response.status, payload);
  }
  return payload;
}

export const authApi = {
  login: (body) => api('/auth/login', { method: 'POST', body, token: null }),
  register: (body) => api('/auth/register', { method: 'POST', body, token: null }),
  me: () => api('/auth/me'),
};
export const donorApi = {
  profile: () => api('/donors/me'),
  availability: (available) => api('/donors/me/availability', { method: 'PATCH', body: { available } }),
  location: (body) => api('/donors/me/location', { method: 'PUT', body }),
  donations: () => api('/donors/me/donations'),
};
export const hospitalApi = {
  profile: () => api('/hospitals/me'),
  update: (body) => api('/hospitals/me', { method: 'PATCH', body }),
  inventory: () => api('/hospitals/me/inventory'),
  matching: (group, coords) => api(`/hospitals/me/matching/${encodeURIComponent(group)}${coords ? `?longitude=${coords.longitude}&latitude=${coords.latitude}` : ''}`),
  donations: () => api('/donations'),
  donationOptions: () => api('/hospitals/for-donation'),
};
export const organizationApi = {
  profile: () => api('/organizations/me'),
  update: (body) => api('/organizations/me', { method: 'PATCH', body }),
  matching: (group, coords) => api(`/organizations/me/matching/${encodeURIComponent(group)}${coords ? `?longitude=${coords.longitude}&latitude=${coords.latitude}` : ''}`),
};
export const requestApi = {
  list: (filters = {}) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    return api(`/requests${query.size ? `?${query}` : ''}`);
  },
  get: (id) => api(`/requests/${id}`),
  create: (body) => api('/requests', { method: 'POST', body }),
  status: (id, status) => api(`/requests/${id}/status`, { method: 'PATCH', body: { status } }),
  fulfil: (id) => api(`/requests/${id}/fulfil`, { method: 'POST', body: {} }),
};
export const donationApi = {
  list: () => api('/donations'),
  create: (body) => api('/donations', { method: 'POST', body }),
  status: (id, status, hospitalId) => api(`/donations/${id}/status`, { method: 'PATCH', body: { status, ...(hospitalId ? { hospitalId } : {}) } }),
};
export const matchingApi = (group, coords) => api(`/matching/${encodeURIComponent(group)}${coords ? `?longitude=${coords.longitude}&latitude=${coords.latitude}` : ''}`);
export const inventoryApi = {
  list: () => api('/inventory'),
  adminList: () => api('/admin/inventory'),
  update: (hospitalId, bloodGroupId, quantity) => api(`/admin/inventory/${hospitalId}/${bloodGroupId}`, { method: 'PUT', body: { quantity: Number(quantity) } }),
};
export const notificationApi = {
  list: (unread = false) => api(`/notifications${unread ? '?unread=true' : ''}`),
  markRead: (id) => api(`/notifications/${id}/read`, { method: 'PATCH', body: {} }),
};
export const adminApi = {
  summary: () => api('/admin/summary'),
  users: () => api('/admin/users'),
  donors: () => api('/admin/donors'),
  requests: () => api('/admin/requests'),
  donations: () => api('/admin/donations'),
  organizations: () => api('/admin/organizations'),
  integrationStatus: (limit = 50) => api(`/admin/integration/status?limit=${encodeURIComponent(limit)}`),
  retryIntegrationEvent: (id) => api(`/admin/integration/outbox/${id}/retry`, { method: 'POST', body: {} }),
};
