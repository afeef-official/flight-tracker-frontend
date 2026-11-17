// Background jobs: slow work (AI ticket extraction) keeps running while you use the rest of the app.
// A tiny store so the strip above the tab bar (components/JobsTray.jsx) can show every job's progress.
import { useSyncExternalStore } from 'react';
import { api } from './api.js';

const DONE_LINGER = 1500;
const STORE_KEY = 'faroway_running_jobs';
const MAX_AGE = 15 * 60 * 1000; // the server forgets a job after this long

// Running jobs are remembered so a reload can pick their progress back up
const stored = () => {
  try {
    const all = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return all.filter((j) => j && j.jobId && Date.now() - j.startedAt < MAX_AGE);
  } catch { return []; }
};
const save = (list) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch { /* storage unavailable */ } };
const forget = (jobId) => { if (jobId) save(stored().filter((j) => j.jobId !== jobId)); };
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
 * Run `work(onProgress, onStart)` in the background. onProgress receives { percent, message }; work calls
 * onStart(jobId) once the server has the job, which is what lets it survive a reload.
 * onDone(result) / onFail(error) run when it ends, even if the screen that started it has gone.
 * `resumed` ({ jobId, startedAt }) picks a stored job back up.
 */
export function runJob(name, work, { onDone, onFail, resumed } = {}) {
  const job = { id: nextId++, name, percent: 5, message: resumed ? 'Checking progress' : 'Uploading', status: 'running', startedAt: resumed?.startedAt || Date.now() };
  let jobId = resumed?.jobId || null;
  const onStart = (id) => { jobId = id; save([...stored().filter((j) => j.jobId !== id), { jobId: id, name, startedAt: job.startedAt }]); };
  jobs = [...jobs, job];
  emit();
  const patch = (p) => { Object.assign(job, p); emit(); };

  return work((info) => patch({
    ...(typeof info.percent === 'number' ? { percent: info.percent } : {}),
    ...(info.message ? { message: info.message } : {})
  }), onStart).then(
    (result) => {
      forget(jobId);
      patch({ status: 'done', percent: 100, message: 'Saved' });
      setTimeout(() => dismissJob(job.id), DONE_LINGER);
      if (onDone) onDone(result);
    },
    (err) => {
      forget(jobId);
      if (resumed && err.code === 'expired') return dismissJob(job.id); // the server no longer has it; nothing to show
      patch({ status: 'failed', message: err.message || 'Failed' });
      if (onFail) onFail(err);
    }
  );
}

/** After a reload: show uploads that were still running and finish them as usual. */
export function resumeJobs(makeHandlers) {
  stored().forEach((j) => {
    runJob(j.name, (onProgress) => api.pollUpload(j.jobId, onProgress), { ...makeHandlers(j.name), resumed: j });
  });
}
