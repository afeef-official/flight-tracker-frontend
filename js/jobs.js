// Background jobs tray: slow work (AI ticket extraction) runs while you keep using the app.
// Each job gets a small card, bottom right, with its stage, a progress bar and a running timer.

const Jobs = (() => {
  const DONE_LINGER = 5000;
  let tray;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function ensureTray() {
    if (tray) return tray;
    tray = document.createElement('div');
    tray.id = 'jobsTray';
    tray.className = 'jobs-tray';
    tray.setAttribute('role', 'region');
    tray.setAttribute('aria-label', 'Background uploads');
    document.body.appendChild(tray);
    return tray;
  }

  function card(name) {
    const el = document.createElement('div');
    el.className = 'job-card';
    el.innerHTML = `
      <span class="job-card__icon material-symbols-outlined" aria-hidden="true">flight_takeoff</span>
      <div class="job-card__body">
        <p class="job-card__name">${esc(name)}</p>
        <p class="job-card__msg" role="status" aria-live="polite">Uploading</p>
        <div class="job-card__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="5"><i></i></div>
      </div>
      <span class="job-card__time">0s</span>
      <button type="button" class="job-card__close" aria-label="Dismiss" hidden>
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>`;
    ensureTray().appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    return el;
  }

  function remove(el) {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 220);
  }

  /**
   * Run `work(onProgress)` in the background and show its progress.
   * onProgress receives { percent, message }. Resolves with whatever `work` returns.
   */
  function run(name, work, { onDone, onFail } = {}) {
    const el = card(name);
    const msg = el.querySelector('.job-card__msg');
    const bar = el.querySelector('.job-card__track');
    const fill = bar.querySelector('i');
    const time = el.querySelector('.job-card__time');
    const close = el.querySelector('.job-card__close');
    const started = Date.now();
    const tick = setInterval(() => { time.textContent = `${Math.floor((Date.now() - started) / 1000)}s`; }, 1000);

    const setPercent = (p) => {
      const v = Math.max(0, Math.min(100, p));
      fill.style.transform = `scaleX(${v / 100})`;
      bar.setAttribute('aria-valuenow', String(Math.round(v)));
    };
    setPercent(5);

    const onProgress = (job) => {
      if (job.message) msg.textContent = job.message;
      if (typeof job.percent === 'number') setPercent(job.percent);
    };

    return work(onProgress).then(
      (result) => {
        clearInterval(tick);
        el.classList.add('is-done');
        el.querySelector('.job-card__icon').textContent = 'check_circle';
        msg.textContent = 'Saved';
        setPercent(100);
        setTimeout(() => remove(el), DONE_LINGER);
        if (onDone) onDone(result);
        return result;
      },
      (err) => {
        clearInterval(tick);
        el.classList.add('is-failed');
        el.querySelector('.job-card__icon').textContent = 'error';
        msg.textContent = err.message || 'Failed';
        close.hidden = false;
        close.addEventListener('click', () => remove(el));
        if (onFail) onFail(err);
      }
    );
  }

  return { run };
})();

window.Jobs = Jobs;
