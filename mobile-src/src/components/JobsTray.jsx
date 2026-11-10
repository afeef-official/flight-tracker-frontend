import React, { useEffect, useState } from 'react';
import { dismissJob, useJobs } from '../jobs.js';

function Row({ job }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (job.status !== 'running') return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [job.status]);
  const secs = Math.floor((now - job.startedAt) / 1000);

  return (
    <div className={`job ${job.status}`}>
      <div className="job-top">
        <span className="job-name ellipsis">{job.name}</span>
        {job.status === 'running' && <span className="job-time">{secs}s</span>}
        {job.status === 'failed' && <button type="button" className="job-x" onClick={() => dismissJob(job.id)}>Dismiss</button>}
      </div>
      <p className="job-msg" role="status" aria-live="polite">{job.message}</p>
      {job.status !== 'failed' && (
        <div className="job-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.percent)}>
          <i style={{ transform: `scaleX(${job.percent / 100})` }} />
        </div>
      )}
    </div>
  );
}

/** Progress for uploads running in the background. Sits in the page flow just above the tab bar, so it never covers content. */
export default function JobsTray() {
  const jobs = useJobs();
  if (!jobs.length) return null;
  return (
    <div className="jobs" role="region" aria-label="Uploads in progress">
      {jobs.map((j) => <Row key={j.id} job={j} />)}
    </div>
  );
}
