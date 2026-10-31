import React from 'react';
import { useLoader } from '../loader.js';

// Plane flying along a dashed arc; shared by the first-load screen and the blocking overlay
export function FlightArc() {
  return (
    <div className="flight" aria-hidden="true">
      <svg className="flight-arc" viewBox="0 0 220 70"><path d="M10 60 Q110 -20 210 60" /></svg>
      <svg className="flight-plane" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" /></svg>
    </div>
  );
}

/** Full-screen loader plus the thin top bar. Mount once at the root. */
export function LoadingLayer() {
  const { open, message, hint, bar, solid } = useLoader();
  return (
    <>
      <div className={`topbar-progress ${bar ? 'on' : ''}`} aria-hidden="true" />
      <div className={`loader-screen ${open ? 'open' : ''} ${solid ? 'solid' : ''}`} role="status" aria-live="polite" aria-busy={open}>
        <div className="loader-card">
          <img src="logo.png" alt="" className="loader-logo" />
          <FlightArc />
          <p className="loader-msg">{message}</p>
          {hint && <p className="loader-hint">{hint}</p>}
        </div>
      </div>
    </>
  );
}

/** Shimmering placeholder cards while a list loads. */
export function Skeletons({ n = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card skel-card">
          <div className="skel" style={{ width: '38%', height: 14 }} />
          <div className="skel" style={{ width: '72%', height: 12, marginTop: 12 }} />
          <div className="skel" style={{ width: '55%', height: 12, marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}
