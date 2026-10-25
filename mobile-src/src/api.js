const CLOUD = 'https://flight-tracker-backend-ijxe.onrender.com';
const LOCAL = 'http://localhost:3000';

export const BASE =
  import.meta.env.VITE_API_URL ||
  (['localhost', '127.0.0.1'].includes(window.location.hostname) ? LOCAL : CLOUD);

const TOKEN_KEY = 'faroway_auth_token';
const USER_KEY = 'faroway_auth_user';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const getUserName = () => {
  try { return localStorage.getItem(USER_KEY) || ''; } catch { return ''; }
};
export const setSession = (token, name) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, name || '');
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } catch { /* storage unavailable */ }
};

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  if (res.status === 401 && token) window.dispatchEvent(new Event('auth-expired'));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.details || `Request failed (HTTP ${res.status})`);
  return data;
}

const qs = (params) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const api = {
  login: async (username, password) => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).catch(() => { throw new Error('Cannot reach the server. Check your connection and try again.'); });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Login failed (HTTP ${res.status})`);
    return data;
  },
  health: () => fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false),

  getFlights: async () => (await request('/api/flights')).flights || [],
  updateFlight: async (id, updates) => (await request(`/api/flights/${encodeURIComponent(id)}`, { method: 'PUT', body: updates })).flight,
  deleteFlight: (id) => request(`/api/flights/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  uploadTicket: async (file, meta) => {
    const form = new FormData();
    form.append('ticket', file);
    form.append('agent', meta.agent);
    form.append('company', meta.agent);
    if (meta.actualCost !== '') form.append('actualCost', meta.actualCost);
    if (meta.sellingPrice !== '') form.append('sellingPrice', meta.sellingPrice);
    return (await request('/api/flights/upload', { method: 'POST', form })).data;
  },

  getRefunds: async () => (await request('/api/refunds')).refunds,
  createRefund: async (body) => (await request('/api/refunds', { method: 'POST', body })).refund,
  updateRefund: async (id, body) => (await request(`/api/refunds/${encodeURIComponent(id)}`, { method: 'PUT', body })).refund,
  deleteRefund: (id) => request(`/api/refunds/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getAgentStatement: (name, from, to) => request(`/api/agents/${encodeURIComponent(name)}/statement${qs({ from, to })}`),
  getProfitReport: (from, to) => request(`/api/reports/profit${qs({ from, to })}`),

  generateTicket: async (file) => {
    const form = new FormData();
    form.append('ticket', file);
    return request('/api/ticket-generator', { method: 'POST', form });
  }
};
