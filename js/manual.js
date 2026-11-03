// Add a booking by hand, without a ticket file: booking date, sector, selling price and cost.
// It is saved like any ticket, so it shows in profit, Today and the agent's statement.

const Manual = (() => {
  const $ = (id) => document.getElementById(id);
  const todayDubai = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  const tagDate = () => { $('manualDateTag').textContent = $('manualDate').value === todayDubai() ? ' (Today)' : ''; };

  function open() {
    $('manualForm').reset();
    $('manualAgent').value = $('agentSelect')?.value && $('agentSelect').value !== 'OTHER' ? $('agentSelect').value : 'Alsaadah Sharjah';
    $('manualDate').value = todayDubai();
    $('manualError').classList.add('hidden');
    tagDate();
    $('manualModal').classList.remove('hidden');
    $('manualSector').focus();
  }

  const close = () => $('manualModal').classList.add('hidden');
  const isOpen = () => !$('manualModal').classList.contains('hidden');

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('manualModal')) return;
    $('manualOpenBtn').addEventListener('click', open);
    $('manualCloseBtn').addEventListener('click', close);
    $('manualCancelBtn').addEventListener('click', close);
    $('manualModal').addEventListener('click', (e) => { if (e.target === $('manualModal')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
    $('manualDate').addEventListener('input', tagDate);

    $('manualForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('manualError');
      const btn = $('manualSaveBtn');
      const sector = $('manualSector').value.trim();
      const price = Number($('manualPrice').value);
      if (!sector) { err.textContent = 'Enter the sector.'; return err.classList.remove('hidden'); }
      if (!(price > 0)) { err.textContent = 'Enter the selling price.'; return err.classList.remove('hidden'); }
      btn.disabled = true;
      err.classList.add('hidden');
      try {
        await window.API.addManualFlight({
          agent: $('manualAgent').value.trim() || undefined,
          bookingDate: $('manualDate').value || undefined,
          sector,
          sellingPrice: price,
          actualCost: $('manualCost').value === '' ? 0 : Number($('manualCost').value)
        });
        close();
        window.UI.showAlert('success', 'Entry Added', `${sector.toUpperCase().replace(/\s*-\s*/, '-')} was added to the statement.`);
        if (window.reloadFlights) await window.reloadFlights();
        if (window.Accounts) window.Accounts.refresh();
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('hidden');
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
