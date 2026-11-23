// Accounts: agent statements and profit report (all amounts in AED)

const Accounts = (() => {
  const esc = (v) => window.UI.esc(v);
  const money = (n) => `AED ${num2(n)}`;
  const profitClass = (n) => (n >= 0 ? 'text-emerald-700' : 'text-rose-600');
  const $ = (id) => document.getElementById(id);

  let currentStatement = null;
  let currentAgent = null;
  let payingAgent = null;
  let editingId = null; // the statement line being edited in place
  let ledgerData = null;

  // "Today" in Dubai, the same day the server uses when no date is sent
  const todayDubai = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  const tagPaymentDate = () => { $('paymentDateTag').textContent = $('paymentDate').value === todayDubai() ? ' (Today)' : ''; };

  function openPayment(agent) {
    payingAgent = agent;
    $('paymentAgent').textContent = agent;
    $('paymentAmount').value = '';
    $('paymentDesc').value = 'Payment';
    $('paymentDate').value = todayDubai();
    $('paymentError').classList.add('hidden');
    tagPaymentDate();
    $('paymentModal').classList.remove('hidden');
    $('paymentAmount').focus();
  }

  const closePayment = () => { $('paymentModal').classList.add('hidden'); payingAgent = null; };

  // The day a ticket was booked (the date it carries on the statement). Tickets saved before the
  // booking date existed fall back to the day they were added, in Dubai time.
  const bookedOn = (f) => {
    if (f.bookingDate) return new Date(f.bookingDate).toISOString().slice(0, 10);
    return f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }) : '';
  };

  // The booking-date range chosen above the agents table (YYYY-MM-DD, either end may be empty)
  const range = () => ({ from: $('stmtFrom').value, to: $('stmtTo').value });
  const inRange = (iso) => { const { from, to } = range(); return (!from || iso >= from) && (!to || iso <= to); };
  function showRangeNote() {
    const { from, to } = range();
    $('stmtRangeNote').textContent = from || to ? `Showing tickets booked ${from ? `from ${from} ` : ''}${to ? `to ${to}` : ''}`.trim() : '';
  }

  async function loadAgents() {
    const body = $('agentsTableBody');
    if (!body.children.length || !body.querySelector('[data-agent]')) {
      body.innerHTML = `<tr><td colspan="6" class="px-4 py-10 text-center"><div class="flex flex-col items-center gap-2 text-slate-500 text-xs font-medium"><span class="loading-spinner"></span>Loading accounts...</div></td></tr>`;
    }
    try {
      const { from, to } = range();
      const r = await window.API.getProfitReport(from, to);
      if (!r.byAgent.length) {
        body.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500 text-sm">${from || to ? 'No tickets booked in this period.' : 'No tickets saved yet.'}</td></tr>`;
        return;
      }
      body.innerHTML = r.byAgent.map((a) => `
        <tr class="hover:bg-slate-50">
          <td data-label="Agent / Branch" class="px-4 py-3 font-semibold text-slate-900">${esc(a.key)}</td>
          <td data-label="Tickets" class="px-4 py-3 text-right font-mono text-xs">${a.tickets}</td>
          <td data-label="Total Selling" class="px-4 py-3 text-right font-mono text-xs">${money(a.billed)}</td>
          <td data-label="Total Cost" class="px-4 py-3 text-right font-mono text-xs">${money(a.cost)}</td>
          <td data-label="Profit" class="px-4 py-3 text-right font-mono text-xs font-bold ${profitClass(a.profit)}">${money(a.profit)}</td>
          <td data-label="" class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-2">
              <button data-pay="${esc(a.key)}" class="px-2.5 h-8 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 whitespace-nowrap">Receive payment</button>
              <button data-agent="${esc(a.key)}" class="text-xs font-bold text-sky-600 hover:underline">Open</button>
            </div>
          </td>
        </tr>`).join('');
    } catch (err) {
      console.warn('Failed to load agents:', err);
      body.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500 text-sm">Could not load accounts.</td></tr>`;
    }
  }

  const inputCls = 'w-full h-8 px-2 rounded-md border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/40';

  function renderLedger() {
    const l = ledgerData;
    const body = $('ledgerBody');
    $('ledgerBalance').textContent = `Balance: ${money(l.balance)}`;
    const lines = l.entries.filter((e) => inRange(new Date(e.date).toISOString().slice(0, 10)));
    body.innerHTML = lines.length ? lines.slice().reverse().map((e) => {
      const iso = new Date(e.date).toISOString().slice(0, 10);
      if (e._id === editingId) {
        return `<tr class="bg-sky-50/60" data-edit-row="${esc(e._id)}">
        <td data-label="Date" class="px-4 py-2"><input type="date" data-f="date" value="${esc(iso)}" class="${inputCls} font-mono"></td>
        <td data-label="Description" class="px-4 py-2"><input type="text" data-f="description" value="${esc(e.description)}" class="${inputCls} uppercase"></td>
        <td data-label="Debits" class="px-4 py-2"><input type="number" step="0.01" min="0" data-f="debit" value="${e.debit || ''}" class="${inputCls} text-right font-mono"></td>
        <td data-label="Credits" class="px-4 py-2"><input type="number" step="0.01" min="0" data-f="credit" value="${e.credit || ''}" class="${inputCls} text-right font-mono"></td>
        <td data-label="Balance" class="px-4 py-2 text-right font-mono text-slate-400">${money(e.balance)}</td>
        <td class="px-4 py-2 text-right whitespace-nowrap">
          <button data-save-entry="${esc(e._id)}" class="text-[11px] font-bold text-emerald-700 hover:underline mr-3">Save</button>
          <button data-cancel-entry class="text-[11px] font-bold text-slate-500 hover:underline">Cancel</button>
        </td>
      </tr>`;
      }
      return `<tr>
        <td data-label="Date" class="px-4 py-2 font-mono">${esc(iso)}</td>
        <td data-label="Description" class="px-4 py-2 uppercase">${esc(e.description)}</td>
        <td data-label="Debits" class="px-4 py-2 text-right font-mono">${e.debit ? money(e.debit) : ''}</td>
        <td data-label="Credits" class="px-4 py-2 text-right font-mono">${e.credit ? money(e.credit) : ''}</td>
        <td data-label="Balance" class="px-4 py-2 text-right font-mono font-bold">${money(e.balance)}</td>
        <td class="px-4 py-2 text-right whitespace-nowrap">${e.source === 'ticket' ? '' : `<button data-edit-entry="${esc(e._id)}" class="text-[11px] font-bold text-sky-600 hover:underline mr-3">Edit</button><button data-del-entry="${esc(e._id)}" class="text-[11px] font-bold text-rose-600 hover:underline">Delete</button>`}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">${l.entries.length ? 'No entries in this period.' : 'No entries yet. New tickets with a cost appear here automatically.'}</td></tr>`;
  }

  async function loadLedger() {
    if (!currentAgent) return;
    const body = $('ledgerBody');
    body.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center"><span class="loading-spinner"></span></td></tr>`;
    try {
      ledgerData = await window.API.getLedger(currentAgent);
      renderLedger();
    } catch (err) {
      body.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">Could not load the statement of account.</td></tr>`;
    }
  }

  async function openStatement(agent) {
    if (currentAgent !== agent) editingId = null;
    currentAgent = agent;
    try {
      currentStatement = await window.API.getAgentStatement(agent, range().from, range().to);
    } catch (err) {
      window.UI.showAlert('error', 'Statement Failed', err.message);
      return;
    }
    const { summary, flights } = currentStatement;
    $('statementTitle').textContent = `Statement: ${currentStatement.agent}`;
    const rf = summary.refunds;
    $('statementSummary').textContent =
      `${summary.tickets} tickets | Selling ${money(summary.billed)} | Cost ${money(summary.cost)} | Profit ${money(summary.profit)}` +
      (rf && rf.count
        ? ` | Refunds received ${money(rf.receivedFromAgent)} | Refunds pending ${money(rf.pendingFromAgent)} | Net payable to agent ${money(summary.netPayableToAgent)}`
        : '');
    const refunds = currentStatement.refunds || [];
    $('statementRefundsWrap').classList.toggle('hidden', !refunds.length);
    $('statementRefundsBody').innerHTML = refunds.map((r) => `<tr class="${r.status === 'Rejected' ? 'opacity-50' : ''}">
      <td data-label="Requested" class="px-4 py-2 font-mono">${esc(r.requestedDate ? new Date(r.requestedDate).toISOString().slice(0, 10) : '')}</td>
      <td data-label="PNR" class="px-4 py-2 font-mono font-bold">${esc(r.bookingReference)}</td>
      <td data-label="Passenger" class="px-4 py-2 uppercase">${esc(r.passengerName)}</td>
      <td data-label="Reason" class="px-4 py-2">${esc(r.reason || '')}</td>
      <td data-label="Status" class="px-4 py-2">${esc(r.status)}</td>
      <td data-label="From Agent" class="px-4 py-2 text-right font-mono">${money(r.refundFromSupplier)}</td>
      <td data-label="To Passenger" class="px-4 py-2 text-right font-mono">${money(r.refundToPassenger)}</td>
    </tr>`).join('');
    // Newest booking first; same-day bookings keep the order they were added, latest on top
    const newestFirst = flights.slice().sort((a, b) => bookedOn(b).localeCompare(bookedOn(a)) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    $('statementBody').innerHTML = flights.length ? newestFirst.map((f) => {
      const cancelled = f.status === 'Cancelled';
      const profit = (f.sellingPrice || 0) - (f.actualCost || 0);
      return `<tr class="${cancelled ? 'opacity-50 line-through' : ''}">
        <td data-label="Booked" class="px-4 py-2 font-mono">${esc(bookedOn(f))}</td>
        <td data-label="Departure" class="px-4 py-2 font-mono">${esc(f.departureTime ? new Date(f.departureTime).toISOString().slice(0, 10) : '')}</td>
        <td data-label="PNR" class="px-4 py-2 font-mono font-bold">${esc(f.bookingReference)}</td>
        <td data-label="Passenger" class="px-4 py-2 uppercase">${esc(f.passengerName)}</td>
        <td data-label="Route" class="px-4 py-2 font-mono">${f.manual ? esc(f.sector) : `${esc(f.origin)} - ${esc(f.destination)}`}</td>
        <td data-label="Airline" class="px-4 py-2">${esc(f.airline)}</td>
        <td data-label="Cost" class="px-4 py-2 text-right font-mono">${money(f.actualCost)}</td>
        <td data-label="Selling" class="px-4 py-2 text-right font-mono">${money(f.sellingPrice)}</td>
        <td data-label="Profit" class="px-4 py-2 text-right font-mono font-bold ${profitClass(profit)}">${money(profit)}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="9" class="px-4 py-6 text-center text-slate-500">No tickets booked in this period.</td></tr>`;
    $('statementPanel').classList.remove('hidden');
    loadLedger();
  }

  function reportRows(rows) {
    if (!rows.length) return `<tr><td class="py-2 text-slate-500">No data</td></tr>`;
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
    $('agentsTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pay]');
      if (btn) openPayment(btn.dataset.pay);
    });
    $('paymentDate').addEventListener('input', tagPaymentDate);
    $('paymentCloseBtn').addEventListener('click', closePayment);
    $('paymentCancelBtn').addEventListener('click', closePayment);
    $('paymentModal').addEventListener('click', (e) => { if (e.target === $('paymentModal')) closePayment(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && payingAgent) closePayment(); });
    $('paymentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = Number($('paymentAmount').value);
      const err = $('paymentError');
      if (!(amount > 0)) {
        err.textContent = 'Enter the amount received.';
        return err.classList.remove('hidden');
      }
      const agent = payingAgent;
      const btn = $('paymentSaveBtn');
      btn.disabled = true;
      err.classList.add('hidden');
      try {
        // A credit on the statement; the description defaults to "Payment", like the lines already there
        await window.API.addLedgerEntry(agent, { date: $('paymentDate').value || undefined, description: $('paymentDesc').value.trim() || 'Payment', credit: amount });
        closePayment();
        window.UI.showAlert('success', 'Payment Recorded', `${money(amount)} received from ${agent} and added to the statement.`);
        if (currentAgent === agent && !$('statementPanel').classList.contains('hidden')) loadLedger();
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('hidden');
      } finally {
        btn.disabled = false;
      }
    });
    const applyRange = () => {
      showRangeNote();
      loadAgents();
      if (!$('statementPanel').classList.contains('hidden') && currentAgent) openStatement(currentAgent);
    };
    $('stmtApplyBtn').addEventListener('click', applyRange);
    $('stmtClearBtn').addEventListener('click', () => { $('stmtFrom').value = ''; $('stmtTo').value = ''; applyRange(); });
    [$('stmtFrom'), $('stmtTo')].forEach((el) => el.addEventListener('change', applyRange));
    // Both downloads use the statement-of-account layout (DATE | DESCRIPTION | Debits | CREDITS | ACCOUNT BALANCE)
    const download = (btn, opts) => async () => {
      if (!currentAgent) return;
      btn.disabled = true;
      try { await window.API.downloadLedger(currentAgent, opts()); } catch (err) { window.UI.showAlert('error', 'Download Failed', err.message); }
      btn.disabled = false;
    };
    $('stmtCsvBtn').addEventListener('click', download($('stmtCsvBtn'), () => ({ format: 'csv', ...range() })));
    $('stmtPdfBtn').addEventListener('click', download($('stmtPdfBtn'), () => ({ format: 'pdf' })));
    $('ledgerSyncBtn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const r = await window.API.syncSheets();
        window.UI.showAlert(r.failed ? 'error' : 'success', 'Google Sheet Sync',
          r.status === 'running' ? 'Still syncing in the background.' : `${r.appended} added, ${r.updated} updated, ${r.removed} removed${r.failed ? `, ${r.failed} failed (${(r.errors || [])[0] || ''})` : ''}. Sheets on the server: ${(r.sheets || []).join(', ') || 'none'}.`);
      } catch (err) { window.UI.showAlert('error', 'Sync Failed', err.message); }
      btn.disabled = false;
    });
    $('stmtCloseBtn').addEventListener('click', () => $('statementPanel').classList.add('hidden'));
    $('rptApplyBtn').addEventListener('click', loadReport);

    $('ledgerAddToggle').addEventListener('click', () => $('ledgerForm').classList.toggle('hidden'));
    $('ledgerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await window.API.addLedgerEntry(currentAgent, {
          date: $('ledgerDate').value || undefined,
          description: $('ledgerDesc').value,
          debit: $('ledgerDebit').value,
          credit: $('ledgerCredit').value
        });
        $('ledgerDebit').value = '';
        $('ledgerCredit').value = '';
        $('ledgerDesc').value = 'Payment';
        await loadLedger();
      } catch (err) {
        window.UI.showAlert('error', 'Could Not Add Entry', err.message);
      }
    });
    $('ledgerBody').addEventListener('click', async (e) => {
      const edit = e.target.closest('[data-edit-entry]');
      if (edit) { editingId = edit.dataset.editEntry; return renderLedger(); }
      if (e.target.closest('[data-cancel-entry]')) { editingId = null; return renderLedger(); }
      const save = e.target.closest('[data-save-entry]');
      if (save) {
        const row = save.closest('tr');
        const v = (f) => row.querySelector(`[data-f="${f}"]`).value;
        save.disabled = true;
        try {
          await window.API.updateLedgerEntry(save.dataset.saveEntry, { date: v('date'), description: v('description'), debit: v('debit'), credit: v('credit') });
          editingId = null;
          await loadLedger();
        } catch (err) {
          save.disabled = false;
          window.UI.showAlert('error', 'Could Not Save Entry', err.message);
        }
        return;
      }
      const btn = e.target.closest('[data-del-entry]');
      if (!btn || !confirm('Delete this entry?')) return;
      try { await window.API.deleteLedgerEntry(btn.dataset.delEntry); await loadLedger(); } catch (err) { window.UI.showAlert('error', 'Delete Failed', err.message); }
    });

    showTab('agents');
    loadAgents();
  });

  return { refresh };
})();

window.Accounts = Accounts;
