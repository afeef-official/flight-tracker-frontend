import { begin, forRequest } from './loader.js';

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
  const end = begin(forRequest(path, method)); // loading screen / top bar while we wait
  try {
    return await send(path, { method, body, form });
  } finally {
    end();
  }
}

async function send(path, { method, body, form }) {
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
    const end = begin(forRequest('/api/auth/login', 'POST'));
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      }).catch(() => { throw new Error('Cannot reach the server. Check your connection and try again.'); });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Login failed (HTTP ${res.status})`);
      return data;
    } finally {
      end();
    }
  },
  health: () => fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false),

  getFlights: async () => (await request('/api/flights')).flights || [],
  updateFlight: async (id, updates) => (await request(`/api/flights/${encodeURIComponent(id)}`, { method: 'PUT', body: updates })).flight,
  deleteFlight: (id) => request(`/api/flights/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  // Extraction runs in the background on the server: start it, then check on it until it finishes
  uploadTicket: async (file, meta, onProgress = () => {}, onStart = () => {}) => {
    const form = new FormData();
    form.append('ticket', file);
    form.append('agent', meta.agent);
    if (meta.bookingDate) form.append('bookingDate', meta.bookingDate);
    form.append('company', meta.agent);
    if (meta.actualCost !== '') form.append('actualCost', meta.actualCost);
    if (meta.sellingPrice !== '') form.append('sellingPrice', meta.sellingPrice);
    const started = await request('/api/flights/upload', { method: 'POST', form });
    if (!started.jobId) return started.data; // older server that still answers in one go
    onStart(started.jobId); // lets the jobs store remember it across an app reload
    return api.pollUpload(started.jobId, onProgress);
  },

  // Follow a background extraction until it ends. Also used to pick one up again after a reload.
  pollUpload: async (jobId, onProgress = () => {}) => {
    let misses = 0;
    for (;;) {
      let job;
      try {
        job = await send(`/api/flights/upload/${jobId}`, { method: 'GET' });
        misses = 0;
      } catch (err) {
        if (/not found|expired/i.test(err.message)) {
          const gone = new Error('This upload expired or the server restarted. Please upload the ticket again.');
          gone.code = 'expired';
          throw gone;
        }
        if (++misses > 5) throw err;
        await new Promise((r) => setTimeout(r, 1000));
        continue; // a dropped request while the server is busy is not the end
      }
      onProgress(job);
      if (job.status === 'done') return job.data;
      if (job.status === 'failed') throw new Error(job.error || 'Failed to process ticket.');
      await new Promise((r) => setTimeout(r, 1000));
    }
  },

  // The statement of account in the sheet's layout. format "csv" = the lines in from/to (booking dates);
  // "xlsx" = the full statement as an Excel file.
  downloadLedger: async (agent, { format = 'xlsx', from = '', to = '' } = {}) => {
    const q = new URLSearchParams({ format });
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const token = getToken();
    const end = begin(forRequest('/api/ledger', 'GET'));
    let res;
    try {
      res = await fetch(`${BASE}/api/ledger/${encodeURIComponent(agent)}/export?${q}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch {
      throw new Error('Cannot reach the server. Check your connection and try again.');
    } finally {
      end();
    }
    if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
    const today = new Date().toLocaleDateString('en-CA');
    const name = agent.replace(/[^a-z0-9]+/gi, '_');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob());
    a.download = format === 'csv' ? `${name}_statement_${from || 'start'}_to_${today}.csv` : `${name}_full_statement_${today}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  getRefunds: async () => (await request('/api/refunds')).refunds,
  createRefund: async (body) => (await request('/api/refunds', { method: 'POST', body })).refund,
  updateRefund: async (id, body) => (await request(`/api/refunds/${encodeURIComponent(id)}`, { method: 'PUT', body })).refund,
  deleteRefund: (id) => request(`/api/refunds/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  addManualFlight: (body) => request('/api/flights/manual', { method: 'POST', body }),
  addLedgerEntry: (agent, body) => request(`/api/ledger/${encodeURIComponent(agent)}`, { method: 'POST', body }),
  getLedger: (agent) => request(`/api/ledger/${encodeURIComponent(agent)}`),
  updateLedgerEntry: (id, body) => request(`/api/ledger/entries/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  deleteLedgerEntry: (id) => request(`/api/ledger/entries/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getAgentStatement: (name, from, to) => request(`/api/agents/${encodeURIComponent(name)}/statement${qs({ from, to })}`),
  getProfitReport: (from, to) => request(`/api/reports/profit${qs({ from, to })}`),

  generateTicket: async (file) => {
    const form = new FormData();
    form.append('ticket', file);
    return request('/api/ticket-generator', { method: 'POST', form });
  }
};
