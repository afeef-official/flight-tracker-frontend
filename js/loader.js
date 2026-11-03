// Loading feedback: a full-screen loader for waits the user is blocked on (first load, AI extraction,
// saving, deleting, exports) and a thin top bar for quick background requests.

const Loader = (() => {
  const $ = (id) => document.getElementById(id);
  const BAR_AFTER = 150;      // top bar appears only if a request is still running after this long
  const OVERLAY_AFTER = 250;  // so quick saves don't flash a full screen
  const MIN_VISIBLE = 450;    // once shown, stay long enough not to flicker
  const SLOW_AFTER = 8000;
  const SPLASH_FAILSAFE = 60000;

  const active = new Set();   // every request in flight
  const blocking = new Map(); // token -> { message, hint } for the ones that block the screen
  // The first-load screen is only for signed-in users; everyone else sees the login form straight away
  let splash = !!$('appLoader')?.hasAttribute('data-boot') && document.documentElement.classList.contains('authed');
  if (!splash) $('appLoader')?.removeAttribute('data-boot');
  let shownAt = 0;
  let barTimer, overlayTimer, hideTimer, slowTimer;

  const SPLASH = { message: 'Loading your dashboard', hint: '' };
  const SPLASH_SLOW = 'Waking up the server. After it has been idle this can take up to a minute.';
  const SLOW = 'Still working. Thanks for your patience.';

  // What to tell the user while a given request runs. Quick background reads get no full screen.
  function forRequest(url, method = 'GET') {
    const m = String(method).toUpperCase();
    const path = String(url);
    if (/\/api\/ledger\/[^/]+\/export/.test(path)) return { blocking: true, message: 'Preparing your Excel statement' };
    if (m === 'GET') return { blocking: false };
    if (/\/api\/flights\/upload|\/upload-ticket/.test(path)) {
      return { blocking: true, message: 'Reading your ticket', hint: 'Extracting passenger and flight details. This usually takes 10 to 20 seconds.' };
    }
    if (/\/api\/flights\/manual/.test(path)) return { blocking: true, message: 'Adding to the statement' };
    if (/\/api\/ticket-generator/.test(path)) return { blocking: true, message: 'Building your ticket', hint: 'Reading the PDF.' };
    if (/\/api\/flights\//.test(path)) return { blocking: true, message: m === 'DELETE' ? 'Deleting traveller' : 'Saving changes' };
    if (/\/api\/refunds/.test(path)) return { blocking: true, message: m === 'DELETE' ? 'Deleting refund' : 'Saving refund' };
    if (/\/api\/ledger\/entries/.test(path)) return { blocking: true, message: 'Removing entry' };
    if (/\/api\/ledger/.test(path)) return { blocking: true, message: 'Adding entry' };
    if (/\/api\/auth\/login/.test(path)) return { blocking: true, message: 'Signing you in' };
    return { blocking: true, message: 'Saving' };
  }

  function renderBar() {
    clearTimeout(barTimer);
    const bar = $('topProgress');
    if (!bar) return;
    if (!active.size) return bar.classList.remove('is-active');
    if (!bar.classList.contains('is-active')) barTimer = setTimeout(() => bar.classList.add('is-active'), BAR_AFTER);
  }

  function current() {
    if (blocking.size) return [...blocking.values()].pop();
    return splash ? SPLASH : null;
  }

  function paint() {
    const el = $('appLoader');
    const info = current();
    if (!el) return;
    if (info) {
      $('loaderMessage').textContent = info.message;
      const hint = $('loaderHint');
      hint.textContent = info.hint || '';
      hint.hidden = !info.hint;
      el.setAttribute('aria-busy', 'true');
      if (!el.classList.contains('is-open')) shownAt = Date.now();
      el.classList.add('is-open');
      clearTimeout(slowTimer);
      slowTimer = setTimeout(() => {
        if (!current()) return;
        hint.textContent = splash && !blocking.size ? SPLASH_SLOW : SLOW;
        hint.hidden = false;
      }, SLOW_AFTER);
    } else {
      clearTimeout(slowTimer);
      el.setAttribute('aria-busy', 'false');
      el.classList.remove('is-open');
    }
  }

  function renderOverlay() {
    clearTimeout(overlayTimer);
    clearTimeout(hideTimer);
    const el = $('appLoader');
    if (!el) return;
    if (current()) {
      if (el.classList.contains('is-open') || splash) return paint();
      overlayTimer = setTimeout(paint, OVERLAY_AFTER);
    } else {
      const wait = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt));
      hideTimer = setTimeout(paint, el.classList.contains('is-open') ? wait : 0);
    }
  }

  /** Start tracking a wait. Returns a function to call when it is over. */
  function begin(opts = {}) {
    const token = {};
    active.add(token);
    if (opts.blocking) blocking.set(token, { message: opts.message || 'Working', hint: opts.hint || '' });
    renderBar();
    if (opts.blocking) renderOverlay();
    let over = false;
    return () => {
      if (over) return;
      over = true;
      active.delete(token);
      blocking.delete(token);
      renderBar();
      renderOverlay();
    };
  }

  /** Show the loader while a promise runs. */
  async function wrap(promise, opts) {
    const end = begin({ blocking: true, ...opts });
    try { return await promise; } finally { end(); }
  }

  /** The dashboard has something to show: drop the first-load screen. */
  function ready() {
    if (!splash) return;
    splash = false;
    const el = $('appLoader');
    el?.removeAttribute('data-boot');
    renderOverlay();
  }

  // Never leave someone stuck behind the first-load screen
  if (splash) {
    paint();
    setTimeout(ready, SPLASH_FAILSAFE);
  }

  return { begin, wrap, ready, forRequest };
})();

window.Loader = Loader;
