import React, { useEffect } from 'react';

export function Sheet({ title, onClose, full, children, footer }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <>
      {!full && <div className="backdrop" onClick={onClose} />}
      <div className={`sheet ${full ? 'full' : ''}`} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div style={{ padding: '10px 16px' }}>{footer}</div>}
      </div>
    </>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return <div className={`toast ${toast.type}`} role="status">{toast.text}</div>;
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function Tile({ label, value, tone }) {
  return (
    <div className="tile">
      <div className="k">{label}</div>
      <div className={`v ${tone || ''}`}>{value}</div>
    </div>
  );
}

const paths = {
  tickets: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7zm6-2v14',
  add: 'M12 5v14M5 12h14',
  accounts: 'M3 10l9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18',
  refunds: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
  generator: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6'
};

export function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
