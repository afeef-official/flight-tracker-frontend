import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Skeletons } from '../components/Loader.jsx';
import { Field, Sheet, Spinner, Tile } from '../components/ui.jsx';
import { bookedOn, fmtDate, fmtDay, money, todayDubai } from '../utils.js';

const tone = (n) => (n >= 0 ? 'pos' : 'neg');

export default function Accounts({ flights, notify }) {
  const [mode, setMode] = useState('agents');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [agent, setAgent] = useState(null);
  const [paying, setPaying] = useState(null); // agent a payment is being received from

  const load = useCallback(async () => {
    setError('');
    try {
      setReport(await api.getProfitReport(from, to)); // booking-date range, shared by the agent list and the profit report
    } catch (err) {
      setError(err.message);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load, flights]);

  return (
    <>
      <h1 className="h1">Accounts</h1>
      <p className="sub">Per-agent statements and profit reports. All amounts in AED.</p>
      <div className="seg">
        <button className={mode === 'agents' ? 'on' : ''} onClick={() => setMode('agents')}>Agent statements</button>
        <button className={mode === 'profit' ? 'on' : ''} onClick={() => setMode('profit')}>Profit report</button>
      </div>
      <div className="grid2">
        <Field label="Booked from"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Booked to"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {error && <p className="error">{error}</p>}
      {!report && !error && <Skeletons n={3} />}

      {report && mode === 'agents' && (
        <>
          {!report.byAgent.length && <div className="empty">{from || to ? 'No tickets booked in this period.' : 'No tickets saved yet.'}</div>}
          {report.byAgent.map((a) => (
            <AgentCard key={a.key} a={a} onOpen={() => setAgent(a.key)} onPay={() => setPaying(a.key)} />
          ))}
        </>
      )}

      {report && mode === 'profit' && (
        <>
          <div className="tiles">
            <Tile label="Tickets" value={report.total.tickets} />
            <Tile label="Selling" value={money(report.total.billed)} />
            <Tile label="Cost" value={money(report.total.cost)} />
            <Tile label="Profit" value={money(report.total.profit)} tone={tone(report.total.profit)} />
          </div>
          <Breakdown title="By month" rows={report.byMonth} />
          <Breakdown title="By agent / branch" rows={[...report.byAgent].sort((x, y) => y.profit - x.profit)} />
          <Breakdown title="By airline" rows={report.byAirline} />
        </>
      )}

      {agent && <Statement name={agent} initialFrom={from} initialTo={to} onClose={() => setAgent(null)} notify={notify} />}
      {paying && <PaymentSheet agent={paying} onClose={() => setPaying(null)} notify={notify} />}
    </>
  );
}

// One agency: what it should pay us per its statement leads; selling and profit sit quietly below, and the two jobs are the footer
function AgentCard({ a, onOpen, onPay }) {
  const due = a.balance || 0;
  const state = due > 0.005 ? 'owed' : due < -0.005 ? 'credit' : 'clear'; // owed = they pay us, credit = they overpaid, clear = settled
  const label = state === 'credit' ? 'Credit with us' : state === 'clear' ? 'Balance' : 'Should pay us';
  const note = state === 'owed' ? 'per statement' : state === 'credit' ? 'overpaid' : 'settled';
  return (
    <div className="card agency">
      <button className="agency-main" onClick={onOpen} aria-label={`Open statement for ${a.key}`}>
        <div className="row between">
          <span className="bold agency-name ellipsis">{a.key}</span>
          <span className="small muted agency-count">{a.tickets} {a.tickets === 1 ? 'ticket' : 'tickets'} ›</span>
        </div>
        <div className="agency-lead">
          <span className="agency-label">{label}</span>
          <div className="row between agency-leadrow">
            <span className={`agency-profit ${state}`}>{money(Math.abs(due))}</span>
            <span className="small muted">{note}</span>
          </div>
        </div>
      </button>
      <div className="agency-foot">
        <button onClick={onOpen}>Open statement</button>
        <button className="pay" onClick={onPay}>Receive payment</button>
      </div>
    </div>
  );
}

// Receive a payment from an agency: recorded as a credit named "Payment" on its statement
function PaymentSheet({ agent, onClose, notify }) {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('Payment');
  const [date, setDate] = useState(todayDubai);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const credit = Number(amount);
    if (!(credit > 0)) return setError('Enter the amount received.');
    setBusy(true);
    setError('');
    try {
      await api.addLedgerEntry(agent, { date: date || undefined, description: desc.trim() || 'Payment', credit });
      notify(`${money(credit)} received from ${agent}.`);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Sheet title="Receive payment" onClose={onClose}
      footer={<button form="paymentForm" className="btn green block" disabled={busy}>{busy ? <Spinner /> : null}Save payment</button>}>
      <form id="paymentForm" onSubmit={submit}>
        <p className="sub">{agent}</p>
        <Field label="Amount received (AED)">
          <input className="input" type="number" step="0.01" min="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus required />
        </Field>
        <Field label="Description">
          <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={80} autoComplete="off" required />
        </Field>
        <Field label={`Date${date === todayDubai() ? ' (Today)' : ''}`}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        {error && <p className="error">{error}</p>}
      </form>
    </Sheet>
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

function Statement({ name, initialFrom = '', initialTo = '', onClose, notify }) {
  const [from, setFrom] = useState(initialFrom); // starts with the range chosen on the list, can be changed here
  const [to, setTo] = useState(initialTo);
  const [data, setData] = useState(null);

  useEffect(() => {
    let live = true;
    api.getAgentStatement(name, from, to)
      .then((d) => live && setData(d))
      .catch((err) => notify(err.message, 'error'));
    return () => { live = false; };
  }, [name, from, to, notify]);

  const [busy, setBusy] = useState('');
  // Both downloads are PDFs in the statement-of-account layout: the selected range (only while one is set) or the full statement
  const download = async (kind) => {
    setBusy(kind);
    try {
      await api.downloadLedger(name, kind === 'range' ? { format: 'pdf', from, to } : { format: 'pdf' });
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const [ledger, setLedger] = useState(null);
  const [editing, setEditing] = useState(null); // a ledger line, or {} for a new one
  const loadLedger = useCallback(async () => {
    try { setLedger(await api.getLedger(name)); } catch (err) { notify(err.message, 'error'); }
  }, [name, notify]);
  useEffect(() => { loadLedger(); }, [loadLedger]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!refresh) return;
    let live = true;
    api.getAgentStatement(name, from, to).then((d) => live && setData(d)).catch(() => {});
    return () => { live = false; };
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = data?.summary;
  return (
    <Sheet title={`Statement: ${name}`} onClose={onClose} full
      footer={(
        <div style={{ display: 'grid', gap: 8 }}>
          {(from || to) && <button className="btn green block" onClick={() => download('range')} disabled={Boolean(busy)}>{busy === 'range' ? <Spinner /> : null}Download selected range</button>}
          <button className="btn ghost block" onClick={() => download('full')} disabled={Boolean(busy)}>{busy === 'full' ? <Spinner /> : null}Download full statement</button>
        </div>
      )}>
      <div className="grid2">
        <Field label="Booked from"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Booked to"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {!data && <Skeletons n={3} />}
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

          <LedgerList ledger={ledger} from={from} to={to} onEdit={setEditing} />

          <h4 style={{ margin: '4px 0 8px' }}>Tickets</h4>
          {!data.flights.length && <div className="empty">No tickets booked in this period.</div>}
          {data.flights.map((f) => {
            const p = (f.sellingPrice || 0) - (f.actualCost || 0);
            return (
              <div className="card" key={f._id} style={f.status === 'Cancelled' ? { opacity: 0.55 } : undefined}>
                <div className="row between"><span className="pnr">{f.bookingReference}</span><span className="small muted">Booked {fmtDay(bookedOn(f))}</span></div>
                <div className="legline" style={{ textTransform: 'uppercase' }}>{f.manual ? f.sector : f.passengerName}</div>
                <div className="route">{f.manual ? 'Added manually' : `${f.origin} → ${f.destination} · ${f.airline}`}</div>
                <div className="small muted" style={{ marginTop: 2 }}>Departs {fmtDate(f.departureTime)}</div>
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
      {editing && (
        <EntrySheet agent={name} entry={editing} notify={notify} onClose={() => setEditing(null)}
          onDone={(ticketChanged) => { setEditing(null); loadLedger(); if (ticketChanged) setRefresh((n) => n + 1); }} />
      )}
    </Sheet>
  );
}

const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

// The statement of account: every debit and credit with its running balance, newest first
function LedgerList({ ledger, from, to, onEdit }) {
  if (!ledger) return null;
  const lines = ledger.entries.filter((e) => {
    const d = isoDay(e.date);
    return (!from || d >= from) && (!to || d <= to);
  }).reverse();
  return (
    <>
      <div className="row between" style={{ margin: '4px 0 8px' }}>
        <h4 style={{ margin: 0 }}>Statement of account</h4>
        <button className="btn sm ghost" onClick={() => onEdit({})}>+ Add entry</button>
      </div>
      <div className="card">
        <div className="row between small" style={{ paddingBottom: 6 }}>
          <span className="muted">Balance (they owe us)</span>
          <span className="mono bold">{money(ledger.balance)}</span>
        </div>
        {!lines.length && <div className="small muted">{ledger.entries.length ? 'No entries in this period.' : 'No entries yet.'}</div>}
        {lines.map((e) => (
          <button key={e._id} className="ledger-line" onClick={() => onEdit(e)} aria-label={`Edit ${e.description}`}>
            <div className="row between">
              <span className="small muted mono">{isoDay(e.date)}</span>
              <span className={`mono small bold ${e.credit ? 'pos' : ''}`}>{e.credit ? `− ${money(e.credit)}` : money(e.debit)}</span>
            </div>
            <div className="row between">
              <span className="small bold ellipsis" style={{ textTransform: 'uppercase' }}>{e.description}</span>
              <span className="small muted mono" style={{ flexShrink: 0, marginLeft: 8 }}>Bal {money(e.balance)} · Edit ›</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// Add, edit or delete one line of the statement. A ticket line edits its ticket (date, wording, amount billed).
function EntrySheet({ agent, entry, onClose, onDone, notify }) {
  const isNew = !entry._id;
  const isTicket = entry.source === 'ticket';
  const [date, setDate] = useState(entry.date ? isoDay(entry.date) : todayDubai());
  const [desc, setDesc] = useState(entry.description || 'Payment');
  const [debit, setDebit] = useState(entry.debit || '');
  const [credit, setCredit] = useState(entry.credit || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setBusy('save');
    setError('');
    try {
      const body = { date, description: desc.trim(), debit, credit };
      if (isNew) await api.addLedgerEntry(agent, body);
      else await api.updateLedgerEntry(entry._id, body);
      notify(isNew ? 'Entry added.' : 'Entry saved.');
      onDone(isTicket);
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this entry?')) return;
    setBusy('del');
    try {
      await api.deleteLedgerEntry(entry._id);
      notify('Entry deleted.');
      onDone(false);
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  return (
    <Sheet title={isNew ? 'Add entry' : 'Edit entry'} onClose={onClose}
      footer={(
        <div style={{ display: 'grid', gap: 8 }}>
          <button form="entryForm" className="btn green block" disabled={Boolean(busy)}>{busy === 'save' ? <Spinner /> : null}Save</button>
          {!isNew && !isTicket && <button type="button" className="btn danger block" onClick={remove} disabled={Boolean(busy)}>{busy === 'del' ? <Spinner /> : null}Delete entry</button>}
        </div>
      )}>
      <form id="entryForm" onSubmit={save}>
        <p className="sub">{agent}{isTicket ? ' · ticket line: changes the ticket\'s booking date, wording and selling price' : ''}</p>
        <Field label="Date"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Description"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={120} autoComplete="off" required /></Field>
        <div className="grid2">
          <Field label="Debit (they owe)"><input className="input" type="number" step="0.01" min="0" inputMode="decimal" value={debit} onChange={(e) => setDebit(e.target.value)} placeholder="0.00" /></Field>
          <Field label="Credit (paid)"><input className="input" type="number" step="0.01" min="0" inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="0.00" disabled={isTicket} /></Field>
        </div>
        {error && <p className="error">{error}</p>}
      </form>
    </Sheet>
  );
}

