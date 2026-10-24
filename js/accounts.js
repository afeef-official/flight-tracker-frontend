// Accounts: agent statements and profit report (all amounts in AED)

const Accounts = (() => {
  const esc = (v) => window.UI.esc(v);
  const money = (n) => `AED ${(Number(n) || 0).toFixed(2)}`;
  const profitClass = (n) => (n >= 0 ? 'text-emerald-700' : 'text-rose-600');
  const $ = (id) => document.getElementById(id);

  let currentStatement = null;
  let currentAgent = null;

  async function loadAgents() {
    const body = $('agentsTableBody');
    try {
      const r = await window.API.getProfitReport();
      if (!r.byAgent.length) {
        body.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500 text-sm">No tickets saved yet.</td></tr>`;
        return;
      }
      body.innerHTML = r.byAgent.map((a) => `
        <tr class="hover:bg-slate-50">
          <td class="px-4 py-3 font-semibold text-slate-900">${esc(a.key)}</td>
          <td class="px-4 py-3 text-right font-mono text-xs">${a.tickets}</td>
          <td class="px-4 py-3 text-right font-mono text-xs">${money(a.billed)}</td>
          <td class="px-4 py-3 text-right font-mono text-xs">${money(a.cost)}</td>
          <td class="px-4 py-3 text-right font-mono text-xs font-bold ${profitClass(a.profit)}">${money(a.profit)}</td>
          <td class="px-4 py-3 text-right"><button data-agent="${esc(a.key)}" class="text-xs font-bold text-sky-600 hover:underline">Open</button></td>
        </tr>`).join('');
    } catch (err) {
      console.warn('Failed to load agents:', err);
      body.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500 text-sm">Could not load accounts.</td></tr>`;
    }
  }

  async function openStatement(agent) {
    currentAgent = agent;
    try {
      currentStatement = await window.API.getAgentStatement(agent, $('stmtFrom').value, $('stmtTo').value);
    } catch (err) {
      window.UI.showAlert('error', 'Statement Failed', err.message);
      return;
    }
    const { summary, flights } = currentStatement;
    $('statementTitle').textContent = `Statement: ${currentStatement.agent}`;
    $('statementSummary').textContent =
      `${summary.tickets} tickets | Selling ${money(summary.billed)} | Cost ${money(summary.cost)} | Profit ${money(summary.profit)}`;
    $('statementBody').innerHTML = flights.length ? flights.map((f) => {
      const cancelled = f.status === 'Cancelled';
      const profit = (f.sellingPrice || 0) - (f.actualCost || 0);
      return `<tr class="${cancelled ? 'opacity-50 line-through' : ''}">
        <td class="px-4 py-2 font-mono">${esc(f.departureTime ? new Date(f.departureTime).toISOString().slice(0, 10) : '')}</td>
        <td class="px-4 py-2 font-mono font-bold">${esc(f.bookingReference)}</td>
        <td class="px-4 py-2 uppercase">${esc(f.passengerName)}</td>
        <td class="px-4 py-2 font-mono">${esc(f.origin)} - ${esc(f.destination)}</td>
        <td class="px-4 py-2">${esc(f.airline)}</td>
        <td class="px-4 py-2 text-right font-mono">${money(f.actualCost)}</td>
        <td class="px-4 py-2 text-right font-mono">${money(f.sellingPrice)}</td>
        <td class="px-4 py-2 text-right font-mono font-bold ${profitClass(profit)}">${money(profit)}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="8" class="px-4 py-6 text-center text-slate-500">No tickets in this period.</td></tr>`;
    $('statementPanel').classList.remove('hidden');
  }

  function downloadCsv() {
    if (!currentStatement) return;
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Date', 'PNR', 'Passenger', 'Origin', 'Destination', 'Airline', 'Status', 'Cost (AED)', 'Selling (AED)', 'Profit (AED)']];
    currentStatement.flights.forEach((f) => rows.push([
      f.departureTime ? new Date(f.departureTime).toISOString().slice(0, 10) : '',
      f.bookingReference, f.passengerName, f.origin, f.destination, f.airline, f.status,
      f.actualCost || 0, f.sellingPrice || 0, (f.sellingPrice || 0) - (f.actualCost || 0)
    ]));
    const s = currentStatement.summary;
    rows.push([], ['Totals', '', '', '', '', '', `${s.tickets} tickets`, s.cost, s.billed, s.profit]);
    const blob = new Blob([rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `statement_${currentStatement.agent.replace(/[^a-z0-9]+/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function reportRows(rows) {
    if (!rows.length) return `<tr><td class="py-2 text-slate-400">No data</td></tr>`;
    return rows.map((r) => `<tr class="border-b border-slate-100">
      <td class="py-1.5 font-semibold text-slate-800">${esc(r.key)}</td>
      <td class="py-1.5 text-right font-mono text-slate-500">${r.tickets}</td>
      <td class="py-1.5 text-right font-mono font-bold ${profitClass(r.profit)}">${money(r.profit)}</td>
    </tr>`).join('');
  }

  async function loadReport() {
    try {
      const r = await window.API.getProfitReport($('rptFrom').value, $('rptTo').value);
      $('rptTotal').innerHTML =
        `Tickets <strong>${r.total.tickets}</strong> | Selling <strong>${money(r.total.billed)}</strong> | Cost <strong>${money(r.total.cost)}</strong> | Profit <strong class="${profitClass(r.total.profit)}">${money(r.total.profit)}</strong>`;
      $('rptMonth').innerHTML = reportRows(r.byMonth);
      $('rptAirline').innerHTML = reportRows(r.byAirline);
      $('rptAgent').innerHTML = reportRows(r.byAgent);
    } catch (err) {
      window.UI.showAlert('error', 'Report Failed', err.message);
    }
  }

  function showTab(tab) {
    $('acctAgents').classList.toggle('hidden', tab !== 'agents');
    $('acctProfit').classList.toggle('hidden', tab !== 'profit');
    document.querySelectorAll('.acct-tab').forEach((b) => {
      const active = b.dataset.tab === tab;
      b.classList.toggle('bg-primary', active);
      b.classList.toggle('text-white', active);
      b.classList.toggle('text-slate-600', !active);
    });
    if (tab === 'profit') loadReport();
  }

  async function refresh() {
    await loadAgents();
    if (!$('acctProfit').classList.contains('hidden')) loadReport();
    if (!$('statementPanel').classList.contains('hidden') && currentAgent) openStatement(currentAgent);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('accountsSection')) return;

    document.querySelectorAll('.acct-tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('agentsTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-agent]');
      if (btn) openStatement(btn.dataset.agent);
    });
    $('stmtApplyBtn').addEventListener('click', () => currentAgent && openStatement(currentAgent));
    $('stmtCsvBtn').addEventListener('click', downloadCsv);
    $('stmtCloseBtn').addEventListener('click', () => $('statementPanel').classList.add('hidden'));
    $('rptApplyBtn').addEventListener('click', loadReport);

    showTab('agents');
    loadAgents();
  });

  return { refresh };
})();

window.Accounts = Accounts;
