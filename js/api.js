// AeroTrack / AeroLedger API Client

const TOKEN_KEY = 'faroway_auth_token';

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

// fetch wrapper that sends the login token and bounces to the login screen on 401
async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // Shows the loading screen / top bar while we wait (see js/loader.js)
  const end = window.Loader ? window.Loader.begin(window.Loader.forRequest(url, options.method)) : () => {};
  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 && window.Auth) window.Auth.showLogin();
    return res;
  } finally {
    end();
  }
}

const API = {
  /**
   * Health check to test backend connectivity
   */
  async checkHealth() {
    const baseUrl = window.CONFIG.getApiUrl();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Fetch all saved flights from backend
   */
  async getFlights() {
    const baseUrl = window.CONFIG.getApiUrl();
    const res = await authFetch(`${baseUrl}/api/flights`);
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.flights || [];
  },

  /**
   * Upload PDF ticket for Gemini parsing with optional company/pricing overrides
   */
  async uploadTicket(file, metadata = {}) {
    const baseUrl = window.CONFIG.getApiUrl();
    const formData = new FormData();
    formData.append('ticket', file);

    if (metadata.agent) formData.append('agent', metadata.agent);
    if (metadata.bookingDate) formData.append('bookingDate', metadata.bookingDate);
    if (metadata.airline) formData.append('airline', metadata.airline);
    if (metadata.company) formData.append('company', metadata.company);
    if (metadata.actualCost !== undefined && metadata.actualCost !== '') {
      formData.append('actualCost', metadata.actualCost);
    }
    if (metadata.sellingPrice !== undefined && metadata.sellingPrice !== '') {
      formData.append('sellingPrice', metadata.sellingPrice);
    }
    if (metadata.currency) formData.append('currency', metadata.currency);

    const res = await authFetch(`${baseUrl}/api/flights/upload`, { method: 'POST', body: formData });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errData.error || errData.details || `Failed with status ${res.status}`);
    }
    const started = await res.json();
    if (!started.jobId) return started.data || started; // older server that still answers in one go

    // Extraction runs in the background on the server: check on it until it finishes
    const onProgress = metadata.onProgress || (() => {});
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let misses = 0;
    for (;;) {
      await sleep(1000);
      let job;
      try {
        const poll = await authFetch(`${baseUrl}/api/flights/upload/${started.jobId}`);
        if (poll.status === 404) throw new Error('This upload expired or the server restarted. Please upload the ticket again.');
        if (!poll.ok) throw new Error(`HTTP ${poll.status}`);
        job = await poll.json();
        misses = 0;
      } catch (err) {
        if (/expired/.test(err.message) || ++misses > 5) throw err;
        continue; // a dropped request while the server is busy is not the end
      }
      onProgress(job);
      if (job.status === 'done') return job.data;
      if (job.status === 'failed') throw new Error(job.error || 'Failed to process ticket.');
    }
  },

  /**
   * Update an existing flight record
   */
  async updateFlight(id, updates) {
    const baseUrl = window.CONFIG.getApiUrl();
    const res = await authFetch(`${baseUrl}/api/flights/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errData.error || `Update failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.flight || data;
  },

  /**
   * Delete a flight by ID or booking reference
   */
  async deleteFlight(id) {
    const baseUrl = window.CONFIG.getApiUrl();
    const res = await authFetch(`${baseUrl}/api/flights/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errData.error || `Delete failed with HTTP ${res.status}`);
    }
    return await res.json();
  }
};

async function request(path, options = {}) {
  const res = await authFetch(`${window.CONFIG.getApiUrl()}${path}`, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

Object.assign(API, {
  async generateTicket(files) {
    const formData = new FormData();
    [].concat(files).forEach((f) => formData.append('ticket', f)); // several files = one trip, merged into one ticket
    const res = await authFetch(`${window.CONFIG.getApiUrl()}/api/ticket-generator`, { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.details || `Failed with status ${res.status}`);
    return data;
  },
  getRefunds: async () => (await request('/api/refunds')).refunds,
  createRefund: async (body) => (await request('/api/refunds', { method: 'POST', body })).refund,
  updateRefund: async (id, body) => (await request(`/api/refunds/${encodeURIComponent(id)}`, { method: 'PUT', body })).refund,
  deleteRefund: (id) => request(`/api/refunds/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getAgentStatement: (name, from, to) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request(`/api/agents/${encodeURIComponent(name)}/statement?${q}`);
  },
  addManualFlight: (body) => request('/api/flights/manual', { method: 'POST', body }),
  getLedger: (agent) => request(`/api/ledger/${encodeURIComponent(agent)}`),
  addLedgerEntry: (agent, body) => request(`/api/ledger/${encodeURIComponent(agent)}`, { method: 'POST', body }),
  deleteLedgerEntry: (id) => request(`/api/ledger/entries/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  async downloadLedgerExcel(agent) {
    const res = await authFetch(`${window.CONFIG.getApiUrl()}/api/ledger/${encodeURIComponent(agent)}/export`);
    if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob());
    a.download = `${agent.replace(/[^a-z0-9]+/gi, '_')}_statement_${new Date().toLocaleDateString('en-CA')}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  getProfitReport: (from, to) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request(`/api/reports/profit?${q}`);
  }
});

Object.assign(API, {
  async login(username, password) {
    const end = window.Loader.begin(window.Loader.forRequest('/api/auth/login', 'POST'));
    let res;
    try {
      res = await fetch(`${window.CONFIG.getApiUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
    } finally {
      end();
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Login failed (HTTP ${res.status})`);
    return data;
  },
  getToken,
  setToken(token) {
    try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch {}
  }
});

window.API = API;