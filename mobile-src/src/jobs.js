// Background jobs: slow work (AI ticket extraction) keeps running while you use the rest of the app.
// A tiny store so the strip above the tab bar (components/JobsTray.jsx) can show every job's progress.
import { useSyncExternalStore } from 'react';

const DONE_LINGER = 1500;
let jobs = [];
let nextId = 1;
const listeners = new Set();
const emit = () => { jobs = [...jobs]; listeners.forEach((l) => l()); };
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

export const useJobs = () => useSyncExternalStore(subscribe, () => jobs);

export function dismissJob(id) {
  jobs = jobs.filter((j) => j.id !== id);
  listeners.forEach((l) => l());
}

/**
 * Run `work(onProgress)` in the background. onProgress receives { percent, message }.
 * onDone(result) / onFail(error) run when it ends, even if the screen that started it has gone.
 */
export function runJob(name, work, { onDone, onFail } = {}) {
  const job = { id: nextId++, name, percent: 5, message: 'Uploading', status: 'running', startedAt: Date.now() };
  jobs = [...jobs, job];
  emit();
  const patch = (p) => { Object.assign(job, p); emit(); };

  return work((info) => patch({
    ...(typeof info.percent === 'number' ? { percent: info.percent } : {}),
    ...(info.message ? { message: info.message } : {})
  })).then(
    (result) => {
      patch({ status: 'done', percent: 100, message: 'Saved' });
      setTimeout(() => dismissJob(job.id), DONE_LINGER);
      if (onDone) onDone(result);
    },
    (err) => {
      patch({ status: 'failed', message: err.message || 'Failed' });
      if (onFail) onFail(err);
    }
  );
}
