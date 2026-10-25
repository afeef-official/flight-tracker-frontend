export const money = (n) => `AED ${(Number(n) || 0).toFixed(2)}`;

export const margin = (cost, price) => {
  const c = parseFloat(cost) || 0;
  const p = parseFloat(price) || 0;
  const diff = p - c;
  return { diff, percent: c > 0 ? ((diff / c) * 100).toFixed(1) : '0', positive: diff >= 0 };
};

export const isUnpriced = (f) => !Number(f.actualCost) && !Number(f.sellingPrice);

export const AGENTS = ['Alsaadah Sharjah', 'Alsaadah Dubai', 'Alsaadah Sajja'];

export const fmtDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d) ? '-' : d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtTime = (iso) => {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return isNaN(d) ? '--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};
export const isoDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const duration = (a, b) => {
  const ms = new Date(b) - new Date(a);
  if (!(ms > 0)) return null;
  const mins = Math.floor(ms / 60000);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
};

export const airline = (f) => f.airline || f.legs?.[0]?.airline || '';
export const agentOf = (f) => f.agent || f.company || 'Alsaadah Sharjah';

// CSV that opens cleanly in Excel; values starting with = + - @ are neutralised (formula injection)
export function downloadCsv(filename, rows) {
  const cell = (v) => {
    let t = String(v ?? '');
    if (/^[=+\-@]/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
