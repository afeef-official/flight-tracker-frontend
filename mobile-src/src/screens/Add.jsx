import React, { useRef, useState } from 'react';
import { api } from '../api.js';
import { Field, Spinner } from '../components/ui.jsx';
import { AGENTS, fmtDate, fmtTime, margin, money, todayDubai } from '../utils.js';

export default function Add({ reload, notify, onSaved }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [agentSel, setAgentSel] = useState(AGENTS[0]);
  const [agentCustom, setAgentCustom] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [bookingDate, setBookingDate] = useState(todayDubai); // shown on the agent's statement
  const [mode, setMode] = useState('upload'); // 'upload' a ticket file, or add 'manual'ly
  const [sector, setSector] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const m = margin(cost, price);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'manual') return submitManual();
    if (!file) return setError('Choose a ticket PDF or photo first.');
    const agent = agentSel === 'OTHER' ? (agentCustom.trim() || 'Other') : agentSel;
    setBusy(true);
    try {
      const saved = await api.uploadTicket(file, { agent, actualCost: cost, sellingPrice: price, bookingDate: bookingDate || todayDubai() });
      setResult(saved);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setCost('');
      setPrice('');
      setBookingDate(todayDubai()); // back to today for the next ticket
      await reload();
      notify(`Ticket ${saved.bookingReference || ''} saved under ${agent}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // A booking without a ticket file: just a sector, a price and a cost, straight onto the statement
  const submitManual = async () => {
    if (!sector.trim()) return setError('Enter the sector.');
    if (!(Number(price) > 0)) return setError('Enter the selling price.');
    const agent = agentSel === 'OTHER' ? (agentCustom.trim() || 'Other') : agentSel;
    setBusy(true);
    try {
      await api.addManualFlight({ agent, bookingDate: bookingDate || todayDubai(), sector: sector.trim(), sellingPrice: Number(price), actualCost: cost === '' ? 0 : Number(cost) });
      const label = sector.trim().toUpperCase();
      setSector('');
      setCost('');
      setPrice('');
      setBookingDate(todayDubai());
      await reload();
      notify(`${label} added to ${agent}'s statement.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const manual = mode === 'manual';

  return (
    <>
      <h1 className="h1">Add ticket</h1>
      <p className="sub">{manual ? 'No ticket file? Enter the sector and amounts. It goes straight onto the statement.' : 'Upload a ticket PDF or take a photo. Flight details are extracted automatically.'}</p>
      <div className="seg">
        <button type="button" className={!manual ? 'on' : ''} onClick={() => { setMode('upload'); setError(''); }}>Upload ticket</button>
        <button type="button" className={manual ? 'on' : ''} onClick={() => { setMode('manual'); setError(''); }}>Add manually</button>
      </div>

      <form onSubmit={submit}>
        {!manual && <div className="card">
          <input ref={fileRef} type="file" accept=".pdf,application/pdf,image/png,image/jpeg,image/webp" hidden
            onChange={(e) => { setFile(e.target.files[0] || null); setError(''); }} />
          <button type="button" className="btn ghost block" onClick={() => fileRef.current?.click()}>
            {file ? 'Change file' : 'Choose PDF or photo'}
          </button>
          {file && <p className="small bold ellipsis" style={{ margin: '8px 0 0' }}>{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
        </div>}

        <Field label="Agent / branch">
          <select className="select" value={agentSel} onChange={(e) => setAgentSel(e.target.value)}>
            {AGENTS.map((a) => <option key={a}>{a}</option>)}
            <option value="OTHER">Other (specify)</option>
          </select>
        </Field>
        {agentSel === 'OTHER' && (
          <Field label="Agent name"><input className="input" value={agentCustom} onChange={(e) => setAgentCustom(e.target.value)} /></Field>
        )}

        {manual && (
          <Field label="Description (sector)">
            <input className="input" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="DXB-COK" maxLength={60} autoComplete="off" />
          </Field>
        )}

        <div className="grid2">
          <Field label="Actual cost (AED)"><input className="input" type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
          <Field label="Selling price (AED)"><input className="input" type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        </div>
        <Field label={`Booking date${bookingDate === todayDubai() ? ' (Today)' : ''}`}>
          <input className="input" type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} required />
        </Field>
        <p className={`small bold ${m.positive ? 'pos' : 'neg'}`}>Est. margin: {m.positive ? '+' : ''}{money(m.diff)} ({m.percent}%)</p>

        {error && <p className="error">{error}</p>}
        <button className="btn block" disabled={busy}>
          {busy ? <><Spinner /> {manual ? 'Saving...' : 'Extracting details...'}</> : manual ? 'Add to statement' : 'Extract & Save'}
        </button>
      </form>

      {!manual && result && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row between"><span className="pnr">{result.bookingReference}</span><span className="pill green">Saved</span></div>
          <div className="legline" style={{ textTransform: 'uppercase' }}>{result.passengerName}</div>
          <div className="route">{result.origin} → {result.destination}</div>
          <div className="small muted" style={{ marginTop: 6 }}>{fmtDate(result.departureTime)} · {fmtTime(result.departureTime)} · {result.legs?.length || 0} flight leg(s)</div>
          <button className="btn ghost block sm" style={{ marginTop: 10 }} onClick={onSaved}>View in Tickets</button>
        </div>
      )}
    </>
  );
}
