// AeroTrack / AeroLedger API Client

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
    const res = await fetch(`${baseUrl}/api/flights`);
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
    if (metadata.airline) formData.append('airline', metadata.airline);
    if (metadata.company) formData.append('company', metadata.company);
    if (metadata.actualCost !== undefined && metadata.actualCost !== '') {
      formData.append('actualCost', metadata.actualCost);
    }
    if (metadata.sellingPrice !== undefined && metadata.sellingPrice !== '') {
      formData.append('sellingPrice', metadata.sellingPrice);
    }
    if (metadata.currency) formData.append('currency', metadata.currency);

    // Try /api/flights/upload first, with fallback to /upload-ticket
    let res;
    try {
      res = await fetch(`${baseUrl}/api/flights/upload`, {
        method: 'POST',
        body: formData
      });
      if (res.status === 404) {
        res = await fetch(`${baseUrl}/upload-ticket`, {
          method: 'POST',
          body: formData
        });
      }
    } catch {
      res = await fetch(`${baseUrl}/upload-ticket`, {
        method: 'POST',
        body: formData
      });
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errData.error || errData.details || `Failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.data || data;
  },

  /**
   * Update an existing flight record
   */
  async updateFlight(id, updates) {
    const baseUrl = window.CONFIG.getApiUrl();
    const res = await fetch(`${baseUrl}/api/flights/${encodeURIComponent(id)}`, {
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
    const res = await fetch(`${baseUrl}/api/flights/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errData.error || `Delete failed with HTTP ${res.status}`);
    }
    return await res.json();
  }
};

window.API = API;
