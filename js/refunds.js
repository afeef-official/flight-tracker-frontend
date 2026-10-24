// Refunds: cancelled tickets, supplier refunds and passenger payouts (all amounts in AED)

const Refunds = (() => {
  const esc = (v) => window.UI.esc(v);
  const money = (n) => `AED ${(Number(n) || 0).toFixed(2)}`;
  const $ = (id) => document.getElementById(id);
  const STATUSES = ['Requested', 'Processing', 'Refunded by Supplier', 'Paid to Passenger', 'Rejected'];
  const STATUS_STYLE = {
    'Requested': 'bg-amber-50 text-amber-700 border-amber-200',
    'Processing': 'bg-sky-50 text-sky-700 border-sky-200',
    'Refunded by Supplier': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Paid to Passenger': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Rejected': 'bg-rose-50 text-rose-700 border-rose-200'
  };

  let refunds = [];
  let flights = [];

  // Money kept by the agency on this ticket after the refund (negative = loss)
  const net = (r) => ((r.originalSelling || 0) - (r.refundToPassenger || 0)) - ((r.originalCost || 0) - (r.refundFromSupplier || 0));
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
  const visible = () => {
    const status = $('refundStatusFilter').value;
    return status ? refunds.filter((r) => r.status === status) : refunds;
  };

  function renderSummary() {
    const open = refunds.filter((r) => r.status === 'Requested' || r.status === 'Processing');
    const active = refunds.filter((r) => r.status !== 'Rejected');
    const sum = (list, key) => list.reduce((a, r) => a + (r[key] || 0), 0);
    const waitingFromAgent = refunds
      .filter((r) => r.status === 'Requested' || r.status === 'Processing')
      .reduce((a, r) => a + (r.refundFromSupplier || 0), 0);
    const owedToPassengers = refunds
      .filter((r) => r.status !== 'Paid to Passenger' && r.status !== 'Rejected')
      .reduce((a, r) => a + (r.refundToPassenger || 0), 0);
    const netTotal = active.reduce((a, r) => a + net(r), 0);
    const tile = (label, value, cls = 'text-slate-900') =>
      `<div class="rounded-xl border border-slate-200 p-3"><div class="text-[10px] font-bold uppercase text-slate-500">${label}</div><div class="mt-1 font-mono font-bold ${cls}">${value}</div></div>`;
    $('refundSummary').innerHTML =
      tile('Open refunds', open.length) +
      tile('Still to get from agents', money(waitingFromAgent)) +
      tile('Still to pay passengers', money(owedToPassengers)) +
      tile('Total received from agents', money(sum(refunds.filter((r) => r.status === 'Refunded by Supplier' || r.status === 'Paid to Passenger'), 'refundFromSupplier'))) +
      tile('Net kept / (lost)', money(netTotal), netTotal >= 0 ? 'text-emerald-700' : 'text-rose-600');
  }

  function renderTable() {
    const body = $('refundsTableBody');
    const list = visible();
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-slate-500 text-sm">No refunds recorded${refunds.length ? ' for this status' : ' yet'}.</td></tr>`;
      return;
    }
    body.innerHTML = list.map((r) => {
      const n = net(r);
      return `<tr class="hover:bg-slate-50">
        <td class="px-4 py-3 font-mono text-xs text-slate-600">${esc(day(r.requestedDate))}</td>
        <td class="px-4 py-3 font-mono font-bold text-xs text-sky-600">${esc(r.bookingReference)}</td>
        <td class="px-4 py-3 text-xs"><div class="font-semibold uppercase text-slate-800">${esc(r.passengerName)}</div><div class="text-[11px] text-slate-400">${esc(r.airline || '')} ${esc(r.route || '')}</div></td>
        <td class="px-4 py-3 text-xs text-slate-600 max-w-[200px]"><div class="truncate">${esc(r.reason || '')}</div><div class="text-[11px] text-slate-400">by ${esc(r.cancelledBy)}</div></td>
        <td class="px-4 py-3 text-right font-mono text-xs">${money(r.refundFromSupplier)}</td>
        <td class="px-4 py-3 text-right font-mono text-xs">${money(r.refundToPassenger)}</td>
        <td class="px-4 py-3 text-right font-mono text-xs font-bold ${n >= 0 ? 'text-emerald-700' : 'text-rose-600'}">${money(n)}</td>
        <td class="px-4 py-3"><select data-status="${esc(r._id)}" class="h-8 px-2 text-[11px] font-semibold rounded-full border ${STATUS_STYLE[r.status] || ''}">
          ${STATUSES.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <button data-edit="${esc(r._id)}" class="p-1.5 text-slate-500 hover:text-amber-600" title="Edit"><span class="material-symbols-outlined text-[18px]">edit</span></button>
          <button data-del="${esc(r._id)}" class="p-1.5 text-slate-400 hover:text-rose-600" title="Delete"><span class="material-symbols-outlined text-[18px]">delete</span></button>
        </td>
      </tr>`;
    }).join('');
  }

  function fillTicketSelect() {
    const sel = $('refundTicket');
    const prev = sel.value;
    sel.innerHTML = '<option value="">Not linked (enter details manually)</option>' +
      flights.map((f) => `<option value="${esc(f._id)}">${esc(f.bookingReference)} - ${esc(f.passengerName)} (${esc(f.origin)} - ${esc(f.destination)})</option>`).join('');
    sel.value = flights.some((f) => f._id === prev) ? prev : '';
  }

  function openForm(refund) {
    $('refundForm').reset();
    $('refundId').value = refund ? refund._id : '';
    $('refundFormTitle').textContent = refund ? `Edit refund: ${refund.bookingReference}` : 'New refund';
    $('refundTicket').disabled = Boolean(refund);
    $('refundMarkWrap').classList.toggle('hidden', Boolean(refund));
    $('refundRequestedDate').value = day(refund?.requestedDate || new Date());
    if (refund) {
      $('refundPnr').value = refund.bookingReference || '';
      $('refundPassenger').value = refund.passengerName || '';
      $('refundAirline').value = refund.airline || '';
      $('refundAgent').value = refund.agent || '';
      $('refundRoute').value = refund.route || '';
      $('refundOrigCost').value = refund.originalCost ?? '';
      $('refundOrigSelling').value = refund.originalSelling ?? '';
      $('refundCancelledBy').value = refund.cancelledBy || 'Airline';
      $('refundFromSupplier').value = refund.refundFromSupplier ?? '';
      $('refundToPassenger').value = refund.refundToPassenger ?? '';
      $('refundCharges').value = refund.cancellationCharges ?? '';
      $('refundStatus').value = refund.status;
      $('refundSupplierDate').value = day(refund.supplierRefundDate);
      $('refundPassengerDate').value = day(refund.passengerRefundDate);
      $('refundReason').value = refund.reason || '';
      $('refundNotes').value = refund.notes || '';
    }
    $('refundForm').classList.remove('hidden');
    $('refundPnr').focus();
  }

  function onTicketPicked() {
    const f = flights.find((x) => x._id === $('refundTicket').value);
    if (!f) return;
    $('refundPnr').value = f.bookingReference || '';
    $('refundPassenger').value = f.passengerName || '';
    $('refundAirline').value = f.airline || '';
    $('refundAgent').value = f.agent || '';
    $('refundRoute').value = `${f.origin || ''} - ${f.destination || ''}`;
    $('refundOrigCost').value = f.actualCost ?? '';
    $('refundOrigSelling').value = f.sellingPrice ?? '';
    $('refundFromSupplier').value = f.actualCost ?? '';
    $('refundToPassenger').value = f.sellingPrice ?? '';
  }

  function formBody() {
    const body = {
      bookingReference: $('refundPnr').value.trim(),
      passengerName: $('refundPassenger').value.trim(),
      airline: $('refundAirline').value.trim() || null,
      agent: $('refundAgent').value.trim() || null,
      route: $('refundRoute').value.trim() || null,
      originalCost: $('refundOrigCost').value,
      originalSelling: $('refundOrigSelling').value,
      cancelledBy: $('refundCancelledBy').value,
      refundFromSupplier: $('refundFromSupplier').value,
      refundToPassenger: $('refundToPassenger').value,
      cancellationCharges: $('refundCharges').value,
      status: $('refundStatus').value,
      requestedDate: $('refundRequestedDate').value,
      supplierRefundDate: $('refundSupplierDate').value,
      passengerRefundDate: $('refundPassengerDate').value,
      reason: $('refundReason').value.trim() || null,
      notes: $('refundNotes').value.trim() || null
    };
    if (!$('refundId').value && $('refundTicket').value) {
      body.flightId = $('refundTicket').value;
      body.markCancelled = $('refundMarkCancelled').checked;
    }
    return body;
  }

  function downloadCsv() {
    const list = visible();
    if (!list.length) {
      window.UI.showAlert('info', 'Nothing to Download', 'There are no refunds to download.');
      return;
    }
    const cell = (v) => {
      let t = String(v ?? '');
      if (/^[=+\-@]/.test(t)) t = `'${t}`;
      return `"${t.replace(/"/g, '""')}"`;
    };
    const rows = [['Requested', 'PNR', 'Passenger', 'Airline', 'Agent', 'Route', 'Reason', 'Cancelled By', 'Original Cost', 'Original Selling',
      'From Agent', 'To Passenger', 'Charges', 'Net', 'Status', 'Agent Refunded On', 'Passenger Paid On', 'Notes', 'Added By']];
    list.forEach((r) => rows.push([day(r.requestedDate), r.bookingReference, r.passengerName, r.airline, r.agent, r.route, r.reason, r.cancelledBy,
      r.originalCost, r.originalSelling, r.refundFromSupplier, r.refundToPassenger, r.cancellationCharges, net(r), r.status,
      day(r.supplierRefundDate), day(r.passengerRefundDate), r.notes, r.addedBy]));
    const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `refunds_${day(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function load() {
    try {
      refunds = await window.API.getRefunds();
    } catch (err) {
      console.warn('Failed to load refunds:', err);
      refunds = [];
    }
    renderSummary();
    renderTable();
  }

  function setFlights(list) {
    flights = list || [];
    fillTicketSelect();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('refundsSection')) return;

    $('newRefundBtn').addEventListener('click', () => openForm(null));
    $('refundCancelBtn').addEventListener('click', () => $('refundForm').classList.add('hidden'));
    $('refundTicket').addEventListener('change', onTicketPicked);
    $('refundStatusFilter').addEventListener('change', renderTable);
    $('refundDownloadBtn').addEventListener('click', downloadCsv);

    $('refundForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('refundId').value;
      const btn = $('refundSaveBtn');
      btn.disabled = true;
      try {
        if (id) await window.API.updateRefund(id, formBody());
        else await window.API.createRefund(formBody());
        $('refundForm').classList.add('hidden');
        window.UI.showAlert('success', 'Refund Saved', `Refund for ${$('refundPnr').value} recorded.`);
        await load();
        if (window.reloadFlights) await window.reloadFlights();
        if (window.Accounts) window.Accounts.refresh();
      } catch (err) {
        window.UI.showAlert('error', 'Could Not Save Refund', err.message);
      } finally {
        btn.disabled = false;
      }
    });

    $('refundsTableBody').addEventListener('click', async (e) => {
      const edit = e.target.closest('[data-edit]');
      const del = e.target.closest('[data-del]');
      if (edit) openForm(refunds.find((r) => r._id === edit.dataset.edit));
      if (del && confirm('Delete this refund record?')) {
        try {
          await window.API.deleteRefund(del.dataset.del);
          await load();
        } catch (err) {
          window.UI.showAlert('error', 'Delete Failed', err.message);
        }
      }
    });

    $('refundsTableBody').addEventListener('change', async (e) => {
      const sel = e.target.closest('[data-status]');
      if (!sel) return;
      try {
        await window.API.updateRefund(sel.dataset.status, { status: sel.value });
        await load();
      } catch (err) {
        window.UI.showAlert('error', 'Status Update Failed', err.message);
        await load();
      }
    });

    load();
  });

  return { setFlights, refresh: load };
})();

window.Refunds = Refunds;
