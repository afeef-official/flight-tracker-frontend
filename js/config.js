// AeroTrack Frontend Configuration

const CONFIG = {
  LOCAL_API: 'http://localhost:3000',
  CLOUD_API: 'https://flight-tracker-backend-ijxe.onrender.com',
  STORAGE_KEY: 'aerotrack_api_target',

  /**
   * Get active API URL from localStorage or default
   */
  getApiUrl() {
    // If served from localhost, always use local API
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return this.LOCAL_API;
    }
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) return saved;
    return this.CLOUD_API;
  },

  /**
   * Set active API URL
   */
  setApiUrl(url) {
    localStorage.setItem(this.STORAGE_KEY, url);
  },

  /**
   * Toggle between Local and Cloud backend
   */
  toggleApi() {
    const current = this.getApiUrl();
    const next = current === this.LOCAL_API ? this.CLOUD_API : this.LOCAL_API;
    this.setApiUrl(next);
    return next;
  },

  isLocal() {
    return this.getApiUrl() === this.LOCAL_API;
  }
};

window.CONFIG = CONFIG;
