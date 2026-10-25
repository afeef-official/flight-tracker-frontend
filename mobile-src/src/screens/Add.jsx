import React, { useRef, useState } from 'react';
import { api } from '../api.js';
import { Field, Spinner } from '../components/ui.jsx';
import { AGENTS, fmtDate, fmtTime, margin, money } from '../utils.js';

export default function Add({ reload, notify, onSaved }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [agentSel, setAgentSel] = useState(AGENTS[0]);
  const [agentCustom, setAgentCustom] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const m = margin(cost, price);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!file) return setError('Choose a ticket PDF or photo first.');
    const agent = agentSel === 'OTHER' ? (agentCustom.trim() || 'Other') : agentSel;
    setBusy(true);
    try {
      const saved = await api.uploadTicket(file, { agent, actualCost: cost, sellingPrice: price });
      setResult(saved);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setCost('');
      setPrice('');
      await reload();
      notify(`Ticket ${saved.bookingReference || ''} saved under ${agent}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="h1">Add ticket</h2>
      <p className="sub">Upload a ticket PDF or take a photo. Flight details are extracted automatically.</p>

      <form onSubmit={submit}>
        <div className="card">
          <input ref={fileRef} type="file" accept=".pdf,application/pdf,image/png,image/jpeg,image/webp" hidden
            onChange={(e) => { setFile(e.target.files[0] || null); setError(''); }} />
          <button type="button" className="btn ghost block" onClick={() => fileRef.current?.click()}>
            {file ? 'Change file' : 'Choose PDF or photo'}
          </button>
          {file && <p className="small bold ellipsis" style={{ margin: '8px 0 0' }}>{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
        </div>

        <Field label="Agent / branch">
          <select className="select" value={agentSel} onChange={(e) => setAgentSel(e.target.value)}>
            {AGENTS.map((a) => <option key={a}>{a}</option>)}
            <option value="OTHER">Other (specify)</option>
          </select>
        </Field>
        {agentSel === 'OTHER' && (
          <Field label="Agent name"><input className="input" value={agentCustom} onChange={(e) => setAgentCustom(e.target.value)} /></Field>
        )}

        <div className="grid2">
          <Field label="Actual cost (AED)"><input className="input" type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
          <Field label="Selling price (AED)"><input className="input" type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        </div>
        <p className={`small bold ${m.positive ? 'pos' : 'neg'}`}>Est. margin: {m.positive ? '+' : ''}{money(m.diff)} ({m.percent}%)</p>

        {error && <p className="error">{error}</p>}
        <button className="btn block" disabled={busy}>{busy ? <><Spinner /> Extracting details...</> : 'Extract & Save'}</button>
      </form>

      {result && (
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
