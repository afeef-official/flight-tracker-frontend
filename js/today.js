// Today: what was booked today (Dubai time), worked out from the tickets already loaded.
// Cancelled tickets are left out of the totals, the same as on the Accounts page.

const Today = (() => {
  const esc = (v) => window.UI.esc(v);
  const $ = (id) => document.getElementById(id);
  const money = (n) => `AED ${num2(n)}`;
  const dubaiDay = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  const bookedOn = (f) => (f.bookingDate ? new Date(f.bookingDate).toISOString().slice(0, 10) : f.createdAt ? dubaiDay(f.createdAt) : '');
  const profitClass = (n) => (n > 0 ? 'text-emerald-700' : n < 0 ? 'text-rose-600' : 'text-slate-500');

  function render(flights) {
    const body = $('todayBody');
    if (!body) return;
    const today = dubaiDay(Date.now());
    $('todayDate').textContent = new Date(`${today}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

    const all = (flights || []).filter((f) => bookedOn(f) === today);
    const list = all.filter((f) => f.status !== 'Cancelled');
    const sum = (key) => list.reduce((a, f) => a + (Number(f[key]) || 0), 0);
    const billed = sum('sellingPrice');
    const cost = sum('actualCost');
    const profit = billed - cost;
    const cancelled = all.length - list.length;
    const unpriced = list.filter((f) => !Number(f.actualCost) && !Number(f.sellingPrice)).length;

    if (!all.length) {
      body.innerHTML = `<div class="px-5 py-10 text-center text-sm text-slate-500">No tickets booked today yet. They will show here as you add them.</div>`;
      return;
    }

    const byAgent = {};
    list.forEach((f) => {
      const k = f.agent || f.company || 'Alsaadah Sharjah';
      const a = byAgent[k] || (byAgent[k] = { tickets: 0, billed: 0, profit: 0 });
      a.tickets += 1;
      a.billed += Number(f.sellingPrice) || 0;
      a.profit += (Number(f.sellingPrice) || 0) - (Number(f.actualCost) || 0);
    });
    const agents = Object.entries(byAgent).sort((a, b) => b[1].profit - a[1].profit);
    const margin = billed > 0 ? `${((profit / billed) * 100).toFixed(1)}% of selling` : '';

    const tile = (label, value, cls = 'text-slate-900') => `
      <div class="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
        <div class="text-xs font-semibold text-slate-500">${label}</div>
        <div class="mt-1 font-mono text-lg font-bold ${cls}">${value}</div>
      </div>`;

    const notes = [
      unpriced ? `${unpriced} ${unpriced === 1 ? 'ticket has' : 'tickets have'} no price yet, so ${unpriced === 1 ? 'it is' : 'they are'} counted as zero.` : '',
      cancelled ? `${cancelled} cancelled ${cancelled === 1 ? 'ticket is' : 'tickets are'} not counted.` : ''
    ].filter(Boolean).join(' ');

    body.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div class="lg:col-span-5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-5 py-4 flex flex-col justify-center">
          <div class="text-xs font-semibold text-emerald-800">Profit today</div>
          <div class="mt-1 font-mono text-3xl font-bold ${profitClass(profit)}">${money(profit)}</div>
          <div class="mt-1 text-xs text-slate-600">${margin || 'No selling price entered yet'}</div>
        </div>
        <div class="lg:col-span-7 grid grid-cols-3 gap-3">
          ${tile('Tickets', list.length)}
          ${tile('Selling', money(billed))}
          ${tile('Cost', money(cost))}
        </div>
      </div>
      ${notes ? `<p class="text-xs text-slate-500">${esc(notes)}</p>` : ''}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <h4 class="text-xs font-semibold text-slate-500 mb-2">By agent</h4>
          <div class="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            ${agents.map(([k, a]) => `<div class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span class="font-semibold text-slate-900 truncate">${esc(k)}</span>
              <span class="text-xs text-slate-500 whitespace-nowrap">${a.tickets} ${a.tickets === 1 ? 'ticket' : 'tickets'}</span>
              <span class="font-mono text-xs font-bold whitespace-nowrap ${profitClass(a.profit)}">${money(a.profit)}</span>
            </div>`).join('') || '<div class="px-4 py-3 text-xs text-slate-500">No active tickets.</div>'}
          </div>
        </div>
        <div>
          <h4 class="text-xs font-semibold text-slate-500 mb-2">Tickets booked today</h4>
          <div class="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            ${all.map((f) => {
              const p = (Number(f.sellingPrice) || 0) - (Number(f.actualCost) || 0);
              const gone = f.status === 'Cancelled';
              return `<div class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${gone ? 'opacity-50' : ''}">
                <div class="min-w-0">
                  <div class="font-semibold text-slate-900 truncate uppercase">${esc(f.passengerName)}</div>
                  <div class="text-xs text-slate-500 truncate"><span class="font-mono">${esc(f.bookingReference)}</span> · ${esc(f.origin)} → ${esc(f.destination)}</div>
                </div>
                ${gone ? '<span class="text-xs font-semibold text-rose-600">Cancelled</span>' : `<span class="font-mono text-xs font-bold whitespace-nowrap ${profitClass(p)}">${money(p)}</span>`}
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  }

  return { render };
})();

window.Today = Today;
