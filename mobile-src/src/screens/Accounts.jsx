import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Field, Sheet, Tile } from '../components/ui.jsx';
import { downloadCsv, fmtDate, isoDay, money } from '../utils.js';

const tone = (n) => (n >= 0 ? 'pos' : 'neg');

export default function Accounts({ flights, notify }) {
  const [mode, setMode] = useState('agents');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [agent, setAgent] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setReport(await api.getProfitReport(mode === 'profit' ? from : '', mode === 'profit' ? to : ''));
    } catch (err) {
      setError(err.message);
    }
  }, [mode, from, to]);

  useEffect(() => { load(); }, [load, flights]);

  return (
    <>
      <h2 className="h1">Accounts</h2>
      <p className="sub">Per-agent statements and profit reports. All amounts in AED.</p>
      <div className="seg">
        <button className={mode === 'agents' ? 'on' : ''} onClick={() => setMode('agents')}>Agent statements</button>
        <button className={mode === 'profit' ? 'on' : ''} onClick={() => setMode('profit')}>Profit report</button>
      </div>
      {error && <p className="error">{error}</p>}
      {!report && !error && <div className="empty">Loading...</div>}

      {report && mode === 'agents' && (
        <>
          {!report.byAgent.length && <div className="empty">No tickets saved yet.</div>}
          {report.byAgent.map((a) => (
            <button key={a.key} className="card tap" onClick={() => setAgent(a.key)}>
              <div className="row between"><span className="bold">{a.key}</span><span className="small muted">{a.tickets} tickets</span></div>
              <div className="tiles" style={{ margin: '10px 0 0' }}>
                <Tile label="Selling" value={money(a.billed)} />
                <Tile label="Cost" value={money(a.cost)} />
                <Tile label="Profit" value={money(a.profit)} tone={tone(a.profit)} />
                <div className="tile row" style={{ justifyContent: 'center', color: 'var(--primary)', fontWeight: 700 }}>Open statement ›</div>
              </div>
            </button>
          ))}
        </>
      )}

      {report && mode === 'profit' && (
        <>
          <div className="grid2">
            <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          <div className="tiles">
            <Tile label="Tickets" value={report.total.tickets} />
            <Tile label="Selling" value={money(report.total.billed)} />
            <Tile label="Cost" value={money(report.total.cost)} />
            <Tile label="Profit" value={money(report.total.profit)} tone={tone(report.total.profit)} />
          </div>
          <Breakdown title="By month" rows={report.byMonth} />
          <Breakdown title="By agent / branch" rows={report.byAgent} />
          <Breakdown title="By airline" rows={report.byAirline} />
        </>
      )}

      {agent && <Statement name={agent} onClose={() => setAgent(null)} notify={notify} />}
    </>
  );
}

function Breakdown({ title, rows }) {
  return (
    <div className="card">
      <div className="bold" style={{ marginBottom: 6 }}>{title}</div>
      {!rows.length && <div className="small muted">No data</div>}
      {rows.map((r) => (
        <div key={r.key} className="row between" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
          <span className="grow ellipsis small bold">{r.key}</span>
          <span className="small muted">{r.tickets}</span>
          <span className={`mono small bold ${tone(r.profit)}`} style={{ minWidth: 96, textAlign: 'right' }}>{money(r.profit)}</span>
        </div>
      ))}
    </div>
  );
}

function Statement({ name, onClose, notify }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let live = true;
    api.getAgentStatement(name, from, to)
      .then((d) => live && setData(d))
      .catch((err) => notify(err.message, 'error'));
    return () => { live = false; };
  }, [name, from, to, notify]);

  const csv = () => {
    if (!data) return;
    const s = data.summary;
    const rows = [['Date', 'PNR', 'Passenger', 'Origin', 'Destination', 'Airline', 'Status', 'Cost (AED)', 'Selling (AED)', 'Profit (AED)']];
    data.flights.forEach((f) => rows.push([isoDay(f.departureTime), f.bookingReference, f.passengerName, f.origin, f.destination, f.airline, f.status, f.actualCost || 0, f.sellingPrice || 0, (f.sellingPrice || 0) - (f.actualCost || 0)]));
    rows.push([], ['Totals', '', '', '', '', '', `${s.tickets} tickets`, s.cost, s.billed, s.profit]);
    if (data.refunds?.length) {
      rows.push([], ['REFUNDS'], ['Requested', 'PNR', 'Passenger', 'Reason', 'Status', 'From Agent (AED)', 'To Passenger (AED)']);
      data.refunds.forEach((r) => rows.push([isoDay(r.requestedDate), r.bookingReference, r.passengerName, r.reason, r.status, r.refundFromSupplier || 0, r.refundToPassenger || 0]));
      rows.push([], ['Refunds received from agent', s.refunds.receivedFromAgent], ['Refunds pending from agent', s.refunds.pendingFromAgent], ['Net payable to agent', s.netPayableToAgent]);
    }
    downloadCsv(`statement_${name.replace(/[^a-z0-9]+/gi, '_')}.csv`, rows);
  };

  const s = data?.summary;
  return (
    <Sheet title={`Statement: ${name}`} onClose={onClose} full
      footer={<button className="btn green block" onClick={csv} disabled={!data}>Download CSV</button>}>
      <div className="grid2">
        <Field label="From"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {!data && <div className="empty">Loading...</div>}
      {data && (
        <>
          <div className="tiles">
            <Tile label="Tickets" value={s.tickets} />
            <Tile label="Selling" value={money(s.billed)} />
            <Tile label="Cost" value={money(s.cost)} />
            <Tile label="Profit" value={money(s.profit)} tone={tone(s.profit)} />
            {s.refunds?.count > 0 && (
              <>
                <Tile label="Refunds received" value={money(s.refunds.receivedFromAgent)} />
                <Tile label="Refunds pending" value={money(s.refunds.pendingFromAgent)} />
                <div style={{ gridColumn: '1 / -1' }}><Tile label="Net payable to agent" value={money(s.netPayableToAgent)} /></div>
              </>
            )}
          </div>

          <h4 style={{ margin: '4px 0 8px' }}>Tickets</h4>
          {!data.flights.length && <div className="empty">No tickets in this period.</div>}
          {data.flights.map((f) => {
            const p = (f.sellingPrice || 0) - (f.actualCost || 0);
            return (
              <div className="card" key={f._id} style={f.status === 'Cancelled' ? { opacity: 0.55 } : undefined}>
                <div className="row between"><span className="pnr">{f.bookingReference}</span><span className="small muted">{fmtDate(f.departureTime)}</span></div>
                <div className="legline" style={{ textTransform: 'uppercase' }}>{f.passengerName}</div>
                <div className="route">{f.origin} → {f.destination} · {f.airline}</div>
                <div className="row between small" style={{ marginTop: 6 }}>
                  <span className="muted">Cost {money(f.actualCost)} · Sell {money(f.sellingPrice)}</span>
                  <span className={`mono bold ${tone(p)}`}>{money(p)}</span>
                </div>
                {f.status === 'Cancelled' && <span className="pill red" style={{ marginTop: 6 }}>Cancelled</span>}
              </div>
            );
          })}

          {data.refunds?.length > 0 && (
            <>
              <h4 style={{ margin: '12px 0 8px' }}>Refunds</h4>
              {data.refunds.map((r) => (
                <div className="card" key={r._id} style={r.status === 'Rejected' ? { opacity: 0.55 } : undefined}>
                  <div className="row between"><span className="pnr">{r.bookingReference}</span><span className="pill blue">{r.status}</span></div>
                  <div className="legline" style={{ textTransform: 'uppercase' }}>{r.passengerName}</div>
                  {r.reason && <div className="small muted">{r.reason}</div>}
                  <div className="row between small" style={{ marginTop: 6 }}>
                    <span className="muted">From agent</span><span className="mono bold">{money(r.refundFromSupplier)}</span>
                  </div>
                  <div className="row between small">
                    <span className="muted">To passenger</span><span className="mono bold">{money(r.refundToPassenger)}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
