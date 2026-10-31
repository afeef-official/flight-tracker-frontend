// Loading feedback: a full-screen loader for waits the user is blocked on (first load, AI extraction,
// saving, deleting) and a thin top bar for quick background requests.
import { useSyncExternalStore } from 'react';

const BAR_AFTER = 150;      // top bar appears only if a request is still running after this long
const OVERLAY_AFTER = 250;  // so quick saves don't flash a full screen
const MIN_VISIBLE = 450;    // once shown, stay long enough not to flicker
const SLOW_AFTER = 8000;
const SPLASH_FAILSAFE = 60000;

const SPLASH = { message: 'Loading your tickets', hint: '' };
const SPLASH_SLOW = 'Waking up the server. After it has been idle this can take up to a minute.';
const SLOW = 'Still working. Thanks for your patience.';

const active = new Set();   // every request in flight
const blocking = new Map(); // token -> { message, hint } for the ones that block the screen
const listeners = new Set();

let splash = false;
let shown = false;
let shownAt = 0;
let barOn = false;
let slow = false;
let msg = SPLASH.message;
let hint = '';
let snap = { open: false, message: msg, hint: '', bar: false, solid: false };
let barTimer = null;
let overlayTimer = null;
let hideTimer = null;
let slowTimer = null;
let splashTimer = null;

const current = () => (blocking.size ? [...blocking.values()].pop() : splash ? SPLASH : null);

function publish() {
  const text = slow ? (splash && !blocking.size ? SPLASH_SLOW : SLOW) : hint;
  const solid = splash && !blocking.size; // first load: nothing half-drawn shows through
  if (snap.open === shown && snap.message === msg && snap.hint === text && snap.bar === barOn && snap.solid === solid) return;
  snap = { open: shown, message: msg, hint: text, bar: barOn, solid };
  listeners.forEach((l) => l());
}

function show() {
  shown = true;
  shownAt = Date.now();
  slow = false;
  clearTimeout(slowTimer);
  slowTimer = setTimeout(() => { slow = true; publish(); }, SLOW_AFTER);
  publish();
}

function hide() {
  shown = false;
  slow = false;
  clearTimeout(slowTimer);
  publish();
}

function refreshOverlay() {
  const info = current();
  if (info) {
    clearTimeout(hideTimer);
    hideTimer = null;
    msg = info.message;
    hint = info.hint || '';
    if (shown) publish();
    else if (splash) show();
    else if (!overlayTimer) {
      overlayTimer = setTimeout(() => { overlayTimer = null; if (current()) show(); }, OVERLAY_AFTER);
    }
  } else {
    clearTimeout(overlayTimer);
    overlayTimer = null;
    if (shown && !hideTimer) {
      hideTimer = setTimeout(() => { hideTimer = null; if (!current()) hide(); }, Math.max(0, MIN_VISIBLE - (Date.now() - shownAt)));
    }
  }
}

function refreshBar() {
  if (active.size) {
    if (!barOn && !barTimer) barTimer = setTimeout(() => { barTimer = null; if (active.size) { barOn = true; publish(); } }, BAR_AFTER);
  } else {
    clearTimeout(barTimer);
    barTimer = null;
    if (barOn) { barOn = false; publish(); }
  }
}

// What to tell the user while a given request runs. Quick background reads get no full screen.
export function forRequest(path, method = 'GET') {
  const m = String(method).toUpperCase();
  if (m === 'GET') return { blocking: false };
  if (/\/api\/flights\/upload/.test(path)) {
    return { blocking: true, message: 'Reading your ticket', hint: 'Extracting passenger and flight details. This usually takes 10 to 20 seconds.' };
  }
  if (/\/api\/ticket-generator/.test(path)) return { blocking: true, message: 'Building your ticket', hint: 'Reading the PDF.' };
  if (/\/api\/flights\//.test(path)) return { blocking: true, message: m === 'DELETE' ? 'Deleting traveller' : 'Saving changes' };
  if (/\/api\/refunds/.test(path)) return { blocking: true, message: m === 'DELETE' ? 'Deleting refund' : 'Saving refund' };
  if (/\/api\/auth\/login/.test(path)) return { blocking: true, message: 'Signing you in' };
  return { blocking: true, message: 'Saving' };
}

/** Start tracking a wait. Returns a function to call when it is over. */
export function begin(opts = {}) {
  const token = {};
  active.add(token);
  if (opts.blocking) blocking.set(token, { message: opts.message || 'Working', hint: opts.hint || '' });
  refreshBar();
  if (opts.blocking) refreshOverlay();
  let over = false;
  return () => {
    if (over) return;
    over = true;
    active.delete(token);
    blocking.delete(token);
    refreshBar();
    refreshOverlay();
  };
}

/** The first-load screen: on while the dashboard has nothing to show yet. */
export function setSplash(on) {
  splash = on;
  publish();
  clearTimeout(splashTimer);
  // Never leave someone stuck behind the first-load screen
  if (on) splashTimer = setTimeout(() => setSplash(false), SPLASH_FAILSAFE);
  refreshOverlay();
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

export const useLoader = () => useSyncExternalStore(subscribe, () => snap);
