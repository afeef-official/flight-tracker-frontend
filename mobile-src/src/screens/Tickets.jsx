import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { Field, Sheet, Spinner } from '../components/ui.jsx';
import {
  AGENTS, agentOf, airline, downloadCsv, duration, fmtDate, fmtTime, isUnpriced, isoDay, margin, money
} from '../utils.js';

const EMPTY = { q: '', agent: '', status: '', airline: '', depFrom: '', depTo: '', addedFrom: '', addedTo: '', origin: '', dest: '', sort: 'newest' };
const STATUSES = ['Confirmed', 'In Review', 'Scheduled', 'Cancelled'];

const savedAt = (f) => {
  const t = new Date(f.createdAt).getTime();
  if (t > 0) return t;
  return f._id ? parseInt(String(f._id).slice(0, 8), 16) * 1000 : 0;
};

function applyFilters(flights, f) {
  const q = f.q.toLowerCase().trim();
  const out = flights.filter((x) => {
    if (q) {
      const hay = [x.bookingReference, x.passengerName, agentOf(x), airline(x), x.origin, x.destination,
        ...(x.legs || []).map((l) => l.flightNumber)].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.agent) {
      const a = agentOf(x);
      if (f.agent === 'OTHER' ? AGENTS.includes(a) : a.toLowerCase() !== f.agent.toLowerCase()) return false;
    }
    if (f.status && (x.status || 'Confirmed').toLowerCase() !== f.status.toLowerCase()) return false;
    if (f.airline && airline(x).toLowerCase() !== f.airline.toLowerCase()) return false;

    const dep = x.departureTime ? new Date(x.departureTime).getTime() : NaN;
    if (f.depFrom && !(dep >= new Date(`${f.depFrom}T00:00:00`).getTime())) return false;
    if (f.depTo && !(dep <= new Date(`${f.depTo}T23:59:59.999`).getTime())) return false;
    const added = x.createdAt ? new Date(x.createdAt).getTime() : NaN;
    if (f.addedFrom && !(added >= new Date(`${f.addedFrom}T00:00:00`).getTime())) return false;
    if (f.addedTo && !(added <= new Date(`${f.addedTo}T23:59:59.999`).getTime())) return false;

    if (f.origin && !(x.origin || '').toLowerCase().includes(f.origin.toLowerCase())) return false;
    if (f.dest && !(x.destination || '').toLowerCase().includes(f.dest.toLowerCase())) return false;
    return true;
  });

  const profit = (x) => (Number(x.sellingPrice) || 0) - (Number(x.actualCost) || 0);
  const sorters = {
    newest: (a, b) => savedAt(b) - savedAt(a),
    oldest: (a, b) => savedAt(a) - savedAt(b),
    passenger: (a, b) => (a.passengerName || '').localeCompare(b.passengerName || ''),
    departure: (a, b) => new Date(a.departureTime || 0) - new Date(b.departureTime || 0),
    margin: (a, b) => profit(b) - profit(a),
    price: (a, b) => (Number(b.sellingPrice) || 0) - (Number(a.sellingPrice) || 0)
  };
  return out.sort(sorters[f.sort] || sorters.newest);
}

const activeCount = (f) => ['agent', 'status', 'airline', 'depFrom', 'depTo', 'addedFrom', 'addedTo', 'origin', 'dest'].filter((k) => f[k]).length + (f.sort !== 'newest' ? 1 : 0);

export default function Tickets({ flights, loading, loadError, reload, notify }) {
  const [filters, setFilters] = useState(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(null);

  const shown = useMemo(() => applyFilters(flights, filters), [flights, filters]);
  const airlines = useMemo(() => [...new Set(flights.map(airline).filter(Boolean))].sort(), [flights]);
  const n = activeCount(filters);

  const download = () => {
    if (!shown.length) return notify('No travellers match the current filters.', 'info');
    const when = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '');
    const rows = [['Agent', 'PNR', 'Passenger', 'Airline', 'Origin', 'Destination', 'Departure', 'Arrival', 'Status', 'Cost (AED)', 'Selling (AED)', 'Profit (AED)', 'Added By', 'Date Added']];
    shown.forEach((f) => {
      const c = Number(f.actualCost) || 0;
      const p = Number(f.sellingPrice) || 0;
      rows.push([agentOf(f), f.bookingReference, f.passengerName, airline(f), f.origin, f.destination, when(f.departureTime), when(f.arrivalTime), f.status || 'Confirmed', c, p, p - c, f.addedBy || '', when(f.createdAt)]);
    });
    downloadCsv(`saved_travellers_${isoDay(new Date())}.csv`, rows);
  };

  return (
    <>
      <input className="input" type="search" placeholder="Search name, PNR, route, airline..." value={filters.q}
        onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
      <div className="row" style={{ margin: '10px 0' }}>
        <button className="btn ghost sm grow" onClick={() => setShowFilters(true)}>Filters{n ? ` (${n})` : ''}</button>
        <button className="btn ghost sm grow" onClick={download}>Download CSV</button>
        <button className="btn ghost sm" onClick={reload} aria-label="Refresh">↻</button>
      </div>
      <p className="sub">
        {loading ? 'Loading...' : n || filters.q ? `Showing ${shown.length} of ${flights.length} travellers` : `${flights.length} travellers`}
        {(n > 0 || filters.q) && <> · <a href="#reset" onClick={(e) => { e.preventDefault(); setFilters(EMPTY); }}>Reset</a></>}
      </p>

      {loadError && <p className="error">{loadError}</p>}
      {!loading && !loadError && !shown.length && <div className="empty">No matching travellers found.</div>}
      {shown.map((f) => <TicketCard key={f._id} f={f} onOpen={() => setSelected(f)} />)}

      {showFilters && (
        <FilterSheet filters={filters} airlines={airlines} onChange={setFilters} onClose={() => setShowFilters(false)} />
      )}
      {selected && (
        <TicketSheet
          f={flights.find((x) => x._id === selected._id) || selected}
          onClose={() => setSelected(null)}
          onChanged={async (msg) => { await reload(); if (msg) notify(msg); }}
          onDeleted={async () => { setSelected(null); await reload(); notify('Traveller deleted.'); }}
          notify={notify}
        />
      )}
    </>
  );
}

function TicketCard({ f, onOpen }) {
  const m = margin(f.actualCost, f.sellingPrice);
  const status = f.status || 'Confirmed';
  return (
    <button className="card tap" onClick={onOpen}>
      <div className="row between">
        <span className="pnr">{f.bookingReference || 'N/A'}</span>
        <span className={`pill ${status === 'Cancelled' ? 'red' : status === 'Confirmed' ? 'green' : 'amber'}`}>{status}</span>
      </div>
      <div className="legline"><span className="grow ellipsis" style={{ textTransform: 'uppercase' }}>{f.passengerName || 'Passenger'}</span></div>
      <div className="route">{f.origin || '---'} → {f.destination || '---'} · {airline(f)}</div>
      <div className="row between small muted" style={{ marginTop: 8 }}>
        <span>{fmtDate(f.departureTime)} · {fmtTime(f.departureTime)}</span>
        <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: '#0ea5e9' }} />{agentOf(f)}</span>
      </div>
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="mono small">{isUnpriced(f) ? '—' : money(f.sellingPrice)}</span>
        {isUnpriced(f)
          ? <span className="pill grey">Not priced</span>
          : <span className={`pill ${m.positive ? 'green' : 'red'}`}>{m.positive ? '+' : ''}{money(m.diff)} ({m.percent}%)</span>}
      </div>
    </button>
  );
}

function FilterSheet({ filters, airlines, onChange, onClose }) {
  const set = (k) => (e) => onChange({ ...filters, [k]: e.target.value });
  return (
    <Sheet
      title="Filters"
      onClose={onClose}
      footer={
        <div className="row">
          <button className="btn ghost grow" onClick={() => onChange({ ...EMPTY, q: filters.q })}>Reset</button>
          <button className="btn grow" onClick={onClose}>Done</button>
        </div>
      }
    >
      <Field label="Sort by">
        <select className="select" value={filters.sort} onChange={set('sort')}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="passenger">Passenger (A-Z)</option>
          <option value="departure">Departure date</option>
          <option value="margin">Highest margin</option>
          <option value="price">Highest price</option>
        </select>
      </Field>
      <div className="grid2">
        <Field label="Agent / branch">
          <select className="select" value={filters.agent} onChange={set('agent')}>
            <option value="">All</option>
            {AGENTS.map((a) => <option key={a}>{a}</option>)}
            <option value="OTHER">Other agents</option>
          </select>
        </Field>
        <Field label="Status">
          <select className="select" value={filters.status} onChange={set('status')}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Airline">
        <select className="select" value={filters.airline} onChange={set('airline')}>
          <option value="">All airlines</option>
          {airlines.map((a) => <option key={a}>{a}</option>)}
        </select>
      </Field>
      <div className="grid2">
        <Field label="Departs from"><input className="input" type="date" value={filters.depFrom} onChange={set('depFrom')} /></Field>
        <Field label="Departs to"><input className="input" type="date" value={filters.depTo} onChange={set('depTo')} /></Field>
        <Field label="Added from"><input className="input" type="date" value={filters.addedFrom} onChange={set('addedFrom')} /></Field>
        <Field label="Added to"><input className="input" type="date" value={filters.addedTo} onChange={set('addedTo')} /></Field>
        <Field label="From (origin)"><input className="input" value={filters.origin} onChange={set('origin')} placeholder="e.g. DXB" autoCapitalize="characters" /></Field>
        <Field label="To (destination)"><input className="input" value={filters.dest} onChange={set('dest')} placeholder="e.g. COK" autoCapitalize="characters" /></Field>
      </div>
    </Sheet>
  );
}

function TicketSheet({ f, onClose, onChanged, onDeleted, notify }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const m = margin(f.actualCost, f.sellingPrice);

  const remove = async () => {
    if (!window.confirm(`Delete traveller record for ${f.passengerName || f.bookingReference}?`)) return;
    setBusy(true);
    try {
      await api.deleteFlight(f._id);
      await onDeleted();
    } catch (err) {
      notify(err.message, 'error');
      setBusy(false);
    }
  };

  if (editing) {
    return <EditSheet f={f} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await onChanged('Changes saved.'); }} notify={notify} />;
  }

  return (
    <Sheet title="Traveller" onClose={onClose}
      footer={
        <div className="row">
          <button className="btn ghost grow" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn danger grow" onClick={remove} disabled={busy}>{busy ? <Spinner /> : null}Delete</button>
        </div>
      }>
      <div className="card">
        <div className="row between"><span className="pnr">{f.bookingReference}</span><span className="pill blue">{agentOf(f)}</span></div>
        <div className="legline" style={{ textTransform: 'uppercase' }}>{f.passengerName}</div>
        <div className="route">{f.origin} → {f.destination} · {airline(f)}</div>
        <div className="small muted" style={{ marginTop: 6 }}>Status: {f.status || 'Confirmed'}{f.addedBy ? ` · Added by ${f.addedBy}` : ''}</div>
      </div>

      <div className="tiles">
        <div className="tile"><div className="k">Actual cost</div><div className="v">{money(f.actualCost)}</div></div>
        <div className="tile"><div className="k">Selling price</div><div className="v">{money(f.sellingPrice)}</div></div>
        <div className="tile" style={{ gridColumn: '1 / -1' }}>
          <div className="k">Profit</div>
          <div className={`v ${isUnpriced(f) ? '' : m.positive ? 'pos' : 'neg'}`}>
            {isUnpriced(f) ? 'Not priced' : `${m.positive ? '+' : ''}${money(m.diff)} (${m.percent}%)`}
          </div>
        </div>
      </div>

      {(f.legs || []).length > 0 && <h4 style={{ margin: '4px 0 8px' }}>Flights ({f.legs.length})</h4>}
      {(f.legs || []).map((l, i) => (
        <div className="card" key={i}>
          <div className="row between"><span className="bold">{l.flightNumber}</span><span className="small muted">{l.airline}</span></div>
          <div className="legline"><span className="mono">{l.fromAirport}</span> → <span className="mono">{l.toAirport}</span></div>
          <div className="small muted">
            {fmtDate(l.departureDateTime)} {fmtTime(l.departureDateTime)} → {fmtDate(l.arrivalDateTime)} {fmtTime(l.arrivalDateTime)}
            {duration(l.departureDateTime, l.arrivalDateTime) ? ` · ${duration(l.departureDateTime, l.arrivalDateTime)}` : ''}
          </div>
          {(l.departureTerminal || l.arrivalTerminal) && <div className="small muted">Terminals: {l.departureTerminal || '-'} / {l.arrivalTerminal || '-'}</div>}
        </div>
      ))}
      {(f.baggage?.cabin || f.baggage?.checkIn) && (
        <div className="card small">Baggage — Check-in: {f.baggage.checkIn || '-'} · Cabin: {f.baggage.cabin || '-'}</div>
      )}
    </Sheet>
  );
}

function EditSheet({ f, onClose, onSaved, notify }) {
  const current = agentOf(f);
  const [form, setForm] = useState({
    bookingReference: f.bookingReference || '',
    passengerName: f.passengerName || '',
    airline: airline(f),
    agentSel: AGENTS.includes(current) ? current : 'OTHER',
    agentCustom: AGENTS.includes(current) ? '' : current,
    actualCost: f.actualCost ?? '',
    sellingPrice: f.sellingPrice ?? '',
    origin: f.origin || '',
    destination: f.destination || '',
    status: f.status || 'Confirmed',
    cabin: f.baggage?.cabin || '',
    checkIn: f.baggage?.checkIn || ''
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const m = margin(form.actualCost, form.sellingPrice);

  const save = async (e) => {
    e.preventDefault();
    const agent = form.agentSel === 'OTHER' ? (form.agentCustom.trim() || 'Other') : form.agentSel;
    setBusy(true);
    try {
      await api.updateFlight(f._id, {
        bookingReference: form.bookingReference.trim(),
        passengerName: form.passengerName.trim(),
        agent,
        company: agent,
        airline: form.airline.trim(),
        actualCost: parseFloat(form.actualCost) || 0,
        sellingPrice: parseFloat(form.sellingPrice) || 0,
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        status: form.status,
        baggage: { cabin: form.cabin.trim() || null, checkIn: form.checkIn.trim() || null }
      });
      await onSaved();
    } catch (err) {
      notify(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <Sheet title="Edit traveller" onClose={onClose} full
      footer={<button form="editForm" className="btn block" disabled={busy}>{busy ? <Spinner /> : null}Save changes</button>}>
      <form id="editForm" onSubmit={save}>
        <Field label="Booking ref (PNR)"><input className="input mono" value={form.bookingReference} onChange={set('bookingReference')} required /></Field>
        <Field label="Passenger name"><input className="input" value={form.passengerName} onChange={set('passengerName')} required /></Field>
        <Field label="Agent / branch">
          <select className="select" value={form.agentSel} onChange={set('agentSel')}>
            {AGENTS.map((a) => <option key={a}>{a}</option>)}
            <option value="OTHER">Other (specify)</option>
          </select>
        </Field>
        {form.agentSel === 'OTHER' && <Field label="Agent name"><input className="input" value={form.agentCustom} onChange={set('agentCustom')} /></Field>}
        <Field label="Airline"><input className="input" value={form.airline} onChange={set('airline')} /></Field>
        <div className="grid2">
          <Field label="Actual cost (AED)"><input className="input" type="number" step="0.01" inputMode="decimal" value={form.actualCost} onChange={set('actualCost')} /></Field>
          <Field label="Selling price (AED)"><input className="input" type="number" step="0.01" inputMode="decimal" value={form.sellingPrice} onChange={set('sellingPrice')} /></Field>
        </div>
        <p className={`small bold ${m.positive ? 'pos' : 'neg'}`}>Profit: {m.positive ? '+' : ''}{money(m.diff)} ({m.percent}%)</p>
        <div className="grid2">
          <Field label="Origin"><input className="input" value={form.origin} onChange={set('origin')} /></Field>
          <Field label="Destination"><input className="input" value={form.destination} onChange={set('destination')} /></Field>
          <Field label="Cabin baggage"><input className="input" value={form.cabin} onChange={set('cabin')} placeholder="7 kg" /></Field>
          <Field label="Check-in baggage"><input className="input" value={form.checkIn} onChange={set('checkIn')} placeholder="20 kg" /></Field>
        </div>
        <Field label="Status">
          <select className="select" value={form.status} onChange={set('status')}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </form>
    </Sheet>
  );
}
