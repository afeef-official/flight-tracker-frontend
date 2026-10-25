import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Field, Sheet, Spinner, Tile } from '../components/ui.jsx';
import { downloadCsv, isoDay, money } from '../utils.js';

const STATUSES = ['Requested', 'Processing', 'Refunded by Supplier', 'Paid to Passenger', 'Rejected'];
const STATUS_PILL = { Requested: 'amber', Processing: 'blue', 'Refunded by Supplier': 'blue', 'Paid to Passenger': 'green', Rejected: 'red' };

// Money the agency keeps on a ticket after the refund (negative = loss)
const net = (r) => ((r.originalSelling || 0) - (r.refundToPassenger || 0)) - ((r.originalCost || 0) - (r.refundFromSupplier || 0));

export default function Refunds({ flights, reload, notify }) {
  const [refunds, setRefunds] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(undefined); // undefined closed, null new, object edit

  const load = useCallback(async () => {
    setError('');
    try {
      setRefunds(await api.getRefunds());
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => (filter ? refunds.filter((r) => r.status === filter) : refunds), [refunds, filter]);

  const summary = useMemo(() => {
    const sum = (arr, k) => arr.reduce((a, r) => a + (r[k] || 0), 0);
    const open = refunds.filter((r) => r.status === 'Requested' || r.status === 'Processing');
    const live = refunds.filter((r) => r.status !== 'Rejected');
    return {
      open: open.length,
      fromAgents: sum(open, 'refundFromSupplier'),
      toPassengers: sum(refunds.filter((r) => r.status !== 'Paid to Passenger' && r.status !== 'Rejected'), 'refundToPassenger'),
      received: sum(refunds.filter((r) => r.status === 'Refunded by Supplier' || r.status === 'Paid to Passenger'), 'refundFromSupplier'),
      net: live.reduce((a, r) => a + net(r), 0)
    };
  }, [refunds]);

  const changeStatus = async (r, status) => {
    try {
      await api.updateRefund(r._id, { status });
      await load();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const remove = async (r) => {
    if (!window.confirm('Delete this refund record?')) return;
    try {
      await api.deleteRefund(r._id);
      await load();
      notify('Refund deleted.');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const download = () => {
    if (!list.length) return notify('There are no refunds to download.', 'info');
    const rows = [['Requested', 'PNR', 'Passenger', 'Airline', 'Agent', 'Route', 'Reason', 'Cancelled By', 'Original Cost', 'Original Selling', 'From Agent', 'To Passenger', 'Charges', 'Net', 'Status', 'Agent Refunded On', 'Passenger Paid On', 'Notes', 'Added By']];
    list.forEach((r) => rows.push([isoDay(r.requestedDate), r.bookingReference, r.passengerName, r.airline, r.agent, r.route, r.reason, r.cancelledBy, r.originalCost, r.originalSelling, r.refundFromSupplier, r.refundToPassenger, r.cancellationCharges, net(r), r.status, isoDay(r.supplierRefundDate), isoDay(r.passengerRefundDate), r.notes, r.addedBy]));
    downloadCsv(`refunds_${isoDay(new Date())}.csv`, rows);
  };

  return (
    <>
      <div className="row between">
        <div>
          <h2 className="h1">Refunds</h2>
          <p className="sub" style={{ marginBottom: 10 }}>Cancelled tickets and money to get back or pay out. AED.</p>
        </div>
        <button className="btn sm" onClick={() => setEditing(null)}>+ New</button>
      </div>

      <div className="tiles">
        <Tile label="Open refunds" value={summary.open} />
        <Tile label="Still to get from agents" value={money(summary.fromAgents)} />
        <Tile label="Still to pay passengers" value={money(summary.toPassengers)} />
        <Tile label="Received from agents" value={money(summary.received)} />
        <div style={{ gridColumn: '1 / -1' }}><Tile label="Net kept / (lost)" value={money(summary.net)} tone={summary.net >= 0 ? 'pos' : 'neg'} /></div>
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <select className="select grow" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn ghost sm" onClick={download}>CSV</button>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && !list.length && <div className="empty">No refunds recorded{refunds.length ? ' for this status' : ' yet'}.</div>}
      {list.map((r) => {
        const n = net(r);
        return (
          <div className="card" key={r._id}>
            <div className="row between">
              <span className="pnr">{r.bookingReference}</span>
              <span className="small muted">{isoDay(r.requestedDate)}</span>
            </div>
            <div className="legline" style={{ textTransform: 'uppercase' }}>{r.passengerName}</div>
            <div className="small muted">{[r.airline, r.route].filter(Boolean).join(' · ')}</div>
            {r.reason && <div className="small" style={{ marginTop: 4 }}>{r.reason} <span className="muted">(by {r.cancelledBy})</span></div>}
            <div className="row between small" style={{ marginTop: 8 }}><span className="muted">From agent</span><span className="mono bold">{money(r.refundFromSupplier)}</span></div>
            <div className="row between small"><span className="muted">To passenger</span><span className="mono bold">{money(r.refundToPassenger)}</span></div>
            <div className="row between small"><span className="muted">Net</span><span className={`mono bold ${n >= 0 ? 'pos' : 'neg'}`}>{money(n)}</span></div>
            <div className="row" style={{ marginTop: 10 }}>
              <select className="select grow" style={{ minHeight: 38, fontSize: 14 }} value={r.status} onChange={(e) => changeStatus(r, e.target.value)} aria-label="Status">
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="btn ghost sm" onClick={() => setEditing(r)}>Edit</button>
              <button className="btn danger sm" onClick={() => remove(r)}>Delete</button>
            </div>
          </div>
        );
      })}

      {editing !== undefined && (
        <RefundForm
          refund={editing}
          flights={flights}
          onClose={() => setEditing(undefined)}
          onSaved={async () => { setEditing(undefined); await load(); await reload(); notify('Refund saved.'); }}
          notify={notify}
        />
      )}
    </>
  );
}

const blank = {
  flightId: '', bookingReference: '', passengerName: '', airline: '', agent: '', route: '', originalCost: '', originalSelling: '',
  cancelledBy: 'Airline', refundFromSupplier: '', refundToPassenger: '', cancellationCharges: '', status: 'Requested',
  requestedDate: isoDay(new Date()), supplierRefundDate: '', passengerRefundDate: '', reason: '', notes: '', markCancelled: true
};

function RefundForm({ refund, flights, onClose, onSaved, notify }) {
  const isEdit = Boolean(refund);
  const [f, setF] = useState(() => isEdit ? {
    ...blank, ...refund,
    requestedDate: isoDay(refund.requestedDate), supplierRefundDate: isoDay(refund.supplierRefundDate), passengerRefundDate: isoDay(refund.passengerRefundDate),
    reason: refund.reason || '', notes: refund.notes || '', airline: refund.airline || '', agent: refund.agent || '', route: refund.route || ''
  } : blank);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const pick = (id) => {
    const t = flights.find((x) => x._id === id);
    if (!t) return setF({ ...f, flightId: '' });
    setF({
      ...f, flightId: id, bookingReference: t.bookingReference || '', passengerName: t.passengerName || '', airline: t.airline || t.legs?.[0]?.airline || '',
      agent: t.agent || '', route: `${t.origin || ''} - ${t.destination || ''}`, originalCost: t.actualCost ?? '', originalSelling: t.sellingPrice ?? '',
      refundFromSupplier: t.actualCost ?? '', refundToPassenger: t.sellingPrice ?? ''
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = {
      bookingReference: f.bookingReference.trim(), passengerName: f.passengerName.trim(), airline: f.airline.trim() || null,
      agent: f.agent.trim() || null, route: f.route.trim() || null, originalCost: f.originalCost, originalSelling: f.originalSelling,
      cancelledBy: f.cancelledBy, refundFromSupplier: f.refundFromSupplier, refundToPassenger: f.refundToPassenger,
      cancellationCharges: f.cancellationCharges, status: f.status, requestedDate: f.requestedDate, supplierRefundDate: f.supplierRefundDate,
      passengerRefundDate: f.passengerRefundDate, reason: f.reason.trim() || null, notes: f.notes.trim() || null
    };
    try {
      if (isEdit) await api.updateRefund(refund._id, body);
      else await api.createRefund({ ...body, ...(f.flightId ? { flightId: f.flightId, markCancelled: f.markCancelled } : {}) });
      await onSaved();
    } catch (err) {
      notify(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Sheet title={isEdit ? `Edit refund: ${refund.bookingReference}` : 'New refund'} onClose={onClose} full
      footer={<button form="refundForm" className="btn block" disabled={busy}>{busy ? <Spinner /> : null}Save refund</button>}>
      <form id="refundForm" onSubmit={save}>
        {!isEdit && (
          <Field label="Link saved ticket (fills the details)">
            <select className="select" value={f.flightId} onChange={(e) => pick(e.target.value)}>
              <option value="">Not linked (enter manually)</option>
              {flights.map((t) => <option key={t._id} value={t._id}>{t.bookingReference} - {t.passengerName}</option>)}
            </select>
          </Field>
        )}
        <div className="grid2">
          <Field label="PNR"><input className="input mono" value={f.bookingReference} onChange={set('bookingReference')} required /></Field>
          <Field label="Passenger"><input className="input" value={f.passengerName} onChange={set('passengerName')} required /></Field>
          <Field label="Airline"><input className="input" value={f.airline} onChange={set('airline')} /></Field>
          <Field label="Agent / branch"><input className="input" value={f.agent} onChange={set('agent')} /></Field>
        </div>
        <Field label="Route"><input className="input" value={f.route} onChange={set('route')} placeholder="e.g. DXB - COK" /></Field>
        <div className="grid2">
          <Field label="Original cost"><input className="input" type="number" step="0.01" inputMode="decimal" value={f.originalCost} onChange={set('originalCost')} /></Field>
          <Field label="Original selling"><input className="input" type="number" step="0.01" inputMode="decimal" value={f.originalSelling} onChange={set('originalSelling')} /></Field>
          <Field label="Refund from agent"><input className="input" type="number" step="0.01" inputMode="decimal" value={f.refundFromSupplier} onChange={set('refundFromSupplier')} /></Field>
          <Field label="Refund to passenger"><input className="input" type="number" step="0.01" inputMode="decimal" value={f.refundToPassenger} onChange={set('refundToPassenger')} /></Field>
          <Field label="Cancellation charges"><input className="input" type="number" step="0.01" inputMode="decimal" value={f.cancellationCharges} onChange={set('cancellationCharges')} /></Field>
          <Field label="Cancelled by">
            <select className="select" value={f.cancelledBy} onChange={set('cancelledBy')}><option>Airline</option><option>Passenger</option><option>Agency</option></select>
          </Field>
        </div>
        <Field label="Status">
          <select className="select" value={f.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <div className="grid2">
          <Field label="Requested on"><input className="input" type="date" value={f.requestedDate} onChange={set('requestedDate')} /></Field>
          <Field label="Agent refunded on"><input className="input" type="date" value={f.supplierRefundDate} onChange={set('supplierRefundDate')} /></Field>
        </div>
        <Field label="Passenger paid on"><input className="input" type="date" value={f.passengerRefundDate} onChange={set('passengerRefundDate')} /></Field>
        <Field label="Reason"><input className="input" value={f.reason} onChange={set('reason')} placeholder="e.g. Flight cancelled by airline" /></Field>
        <Field label="Notes"><input className="input" value={f.notes} onChange={set('notes')} /></Field>
        {!isEdit && f.flightId && (
          <label className="row small bold" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={f.markCancelled} onChange={(e) => setF({ ...f, markCancelled: e.target.checked })} />
            Mark the linked ticket as Cancelled
          </label>
        )}
      </form>
    </Sheet>
  );
}
