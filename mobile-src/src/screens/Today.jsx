import React from 'react';
import { Skeletons } from '../components/Loader.jsx';
import { Tile } from '../components/ui.jsx';
import { agentOf, bookedOn, money, todayDubai } from '../utils.js';

const tone = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted');

// What was booked today (Dubai time), worked out from the tickets already loaded.
// Cancelled tickets are left out of the totals, the same as on the Accounts screen.
export default function Today({ flights, loading, loadError }) {
  const today = todayDubai();
  const all = flights.filter((f) => bookedOn(f) === today);
  const list = all.filter((f) => f.status !== 'Cancelled');
  const billed = list.reduce((a, f) => a + (Number(f.sellingPrice) || 0), 0);
  const cost = list.reduce((a, f) => a + (Number(f.actualCost) || 0), 0);
  const profit = billed - cost;
  const cancelled = all.length - list.length;
  const unpriced = list.filter((f) => !Number(f.actualCost) && !Number(f.sellingPrice)).length;

  const byAgent = {};
  list.forEach((f) => {
    const a = byAgent[agentOf(f)] || (byAgent[agentOf(f)] = { tickets: 0, profit: 0 });
    a.tickets += 1;
    a.profit += (Number(f.sellingPrice) || 0) - (Number(f.actualCost) || 0);
  });
  const agents = Object.entries(byAgent).sort((a, b) => b[1].profit - a[1].profit);

  const dateLabel = new Date(`${today}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  return (
    <>
      <h1 className="h1">Today</h1>
      <p className="sub">{dateLabel}</p>
      {loadError && <p className="error">{loadError}</p>}
      {loading && !flights.length && <Skeletons n={3} />}

      {(!loading || flights.length > 0) && !loadError && !all.length && (
        <div className="empty">No tickets booked today yet. They will show here as you add them.</div>
      )}

      {all.length > 0 && (
        <>
          <div className="card today-lead">
            <span className="agency-label">Profit today</span>
            <span className={`agency-profit ${tone(profit)}`}>{money(profit)}</span>
            <span className="small muted">{billed > 0 ? `${((profit / billed) * 100).toFixed(1)}% of selling` : 'No selling price entered yet'}</span>
          </div>
          <div className="tiles">
            <Tile label="Tickets" value={list.length} />
            <Tile label="Selling" value={money(billed)} />
            <Tile label="Cost" value={money(cost)} />
            <Tile label="Cancelled" value={cancelled} />
          </div>
          {unpriced > 0 && <p className="small muted" style={{ margin: '0 0 12px' }}>{unpriced} {unpriced === 1 ? 'ticket has' : 'tickets have'} no price yet and count as zero.</p>}

          <h4 style={{ margin: '4px 0 8px' }}>By agent</h4>
          <div className="card">
            {agents.map(([name, a], i) => (
              <div key={name} className="row between" style={{ padding: '7px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
                <span className="grow ellipsis small bold">{name}</span>
                <span className="small muted">{a.tickets}</span>
                <span className={`mono small bold ${a.profit >= 0 ? 'pos' : 'neg'}`} style={{ minWidth: 96, textAlign: 'right' }}>{money(a.profit)}</span>
              </div>
            ))}
          </div>

          <h4 style={{ margin: '12px 0 8px' }}>Booked today</h4>
          {all.map((f) => {
            const p = (Number(f.sellingPrice) || 0) - (Number(f.actualCost) || 0);
            return (
              <div className="card" key={f._id} style={f.status === 'Cancelled' ? { opacity: 0.55 } : undefined}>
                <div className="row between"><span className="pnr">{f.bookingReference}</span>
                  {f.status === 'Cancelled' ? <span className="pill red">Cancelled</span> : <span className={`mono small bold ${p >= 0 ? 'pos' : 'neg'}`}>{money(p)}</span>}
                </div>
                <div className="legline" style={{ textTransform: 'uppercase' }}>{f.passengerName}</div>
                <div className="route">{f.origin} → {f.destination} · {f.airline}</div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
