// AeroLedger DB — Main Application Controller

document.addEventListener('DOMContentLoaded', () => {
  // Form & Dropzone Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const dropzonePrompt = document.getElementById('dropzonePrompt');
  const dropzoneSelected = document.getElementById('dropzoneSelected');
  const selectedFileName = document.getElementById('selectedFileName');
  const selectedFileSize = document.getElementById('selectedFileSize');
  const removeFileBtn = document.getElementById('removeFileBtn');
  
  const agentSelect = document.getElementById('agentSelect');
  const agentCustom = document.getElementById('agentCustom');
  const actualCostInput = document.getElementById('actualCost');
  const sellingPriceInput = document.getElementById('sellingPrice');
  const marginDisplay = document.getElementById('marginDisplay');
  const intakeForm = document.getElementById('flightIntakeForm');
  const extractBtn = document.getElementById('extractBtn');
  const extractBtnText = document.getElementById('extractBtnText');
  const extractSpinner = document.getElementById('extractSpinner');
  
  // Navigation & Control Elements
  const refreshDbBtn = document.getElementById('refreshDbBtn');
  const toggleApiBtn = document.getElementById('toggleApiBtn');
  const copyPnrBtn = document.getElementById('copyPnrBtn');
  const copySuccessBadge = document.getElementById('copySuccessBadge');

  // Filter & Search Elements for Saved Travellers
  const searchInput = document.getElementById('savedFlightsSearch');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const filterAgent = document.getElementById('filterAgent');
  const filterStatus = document.getElementById('filterStatus');
  const filterSort = document.getElementById('filterSort');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const countBadge = document.getElementById('savedFlightsCountBadge');
  const filterIds = ['filterDepFrom', 'filterDepTo', 'filterAddedFrom', 'filterAddedTo', 'filterAirline', 'filterOrigin', 'filterDest'];
  const advFilter = (id) => (document.getElementById(id)?.value || '').trim();

  // Modal Elements
  const closeEditModalBtn = document.getElementById('closeEditModalBtn');
  const cancelEditModalBtn = document.getElementById('cancelEditModalBtn');

  let lastFiltered = [];
  let currentFile = null;
  let cachedFlights = [];

  // Agent dropdown change listener to toggle custom text field
  if (agentSelect && agentCustom) {
    agentSelect.addEventListener('change', () => {
      if (agentSelect.value === 'OTHER') {
        agentCustom.classList.remove('hidden');
        agentCustom.focus();
      } else {
        agentCustom.classList.add('hidden');
        agentCustom.value = '';
      }
    });
  }

  // Live Margin Calculation on Intake Form
  function updateIntakeMargin() {
    if (!actualCostInput || !sellingPriceInput || !marginDisplay) return;
    const res = window.UI.calculateMargin(actualCostInput.value, sellingPriceInput.value);
    if (res.isPositive) {
      marginDisplay.textContent = `+AED ${res.diff.toFixed(2)} (+${res.percent}%)`;
      marginDisplay.className = 'text-emerald-700 font-mono font-bold';
    } else {
      marginDisplay.textContent = `-AED ${Math.abs(res.diff).toFixed(2)} (${res.percent}%)`;
      marginDisplay.className = 'text-rose-600 font-mono font-bold';
    }
  }

  if (actualCostInput && sellingPriceInput) {
    actualCostInput.addEventListener('input', updateIntakeMargin);
    sellingPriceInput.addEventListener('input', updateIntakeMargin);
    updateIntakeMargin();
  }

  // File Selection Handling
  function handleFileSelected(file) {
    if (!file) return;
    currentFile = file;
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    
    dropzonePrompt.classList.add('hidden');
    dropzoneSelected.classList.remove('hidden');
    window.UI.hideAlert();
  }

  function resetFileSelection() {
    currentFile = null;
    fileInput.value = '';
    dropzoneSelected.classList.add('hidden');
    dropzonePrompt.classList.remove('hidden');
  }

  if (dropZone) {
    dropZone.addEventListener('click', (e) => {
      if (e.target !== removeFileBtn && !removeFileBtn.contains(e.target)) {
        fileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach(event => {
      dropZone.addEventListener(event, (e) => {
        e.preventDefault();
        dropZone.classList.add('border-sky-500', 'bg-sky-50/50');
      });
    });

    ['dragleave', 'drop'].forEach(event => {
      dropZone.addEventListener(event, (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-sky-500', 'bg-sky-50/50');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelected(e.target.files[0]);
      }
    });
  }

  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetFileSelection();
    });
  }

  // Sync / Load Flights from Database
  async function loadFlights() {
    const isOnline = await window.API.checkHealth();
    window.UI.updateGatewayBadge(isOnline, window.CONFIG.isLocal());

    try {
      cachedFlights = await window.API.getFlights();
      populateAirlineFilter();
      applyFlightFilter();
    } catch (err) {
      console.warn('Failed to load trips:', err);
      window.UI.renderSavedFlightsTable([], {
        onSelect: () => {},
        onEdit: () => {},
        onDelete: () => {}
      });
      if (countBadge) countBadge.textContent = isOnline ? '0 travellers' : 'Offline';
    }
  }

  // Filter, Search, and Sort Logic for Saved Travellers
  function applyFlightFilter() {
    const q = (searchInput?.value || '').toLowerCase().trim();
    const selectedAgent = filterAgent?.value || '';
    const selectedStatus = filterStatus?.value || '';
    const sortBy = filterSort?.value || 'newest';

    // Show or hide clear search button
    if (clearSearchBtn) {
      if (q) clearSearchBtn.classList.remove('hidden');
      else clearSearchBtn.classList.add('hidden');
    }

    // Show or hide reset filters button
    const isFiltered = Boolean(q || selectedAgent || selectedStatus || (sortBy !== 'newest') || filterIds.some(advFilter));
    if (resetFiltersBtn) {
      if (isFiltered) resetFiltersBtn.classList.remove('hidden');
      else resetFiltersBtn.classList.add('hidden');
    }

    const standardAgents = ['Alsaadah Sharjah', 'Alsaadah Dubai', 'Alsaadah Sajja'];

    let filtered = cachedFlights.filter(f => {
      // 1. Text Search across PNR, Passenger, Agent, Airline, Route
      if (q) {
        const pnr = (f.bookingReference || '').toLowerCase();
        const name = (f.passengerName || '').toLowerCase();
        const agent = (f.agent || f.company || '').toLowerCase();
        const airline = (f.airline || f.legs?.[0]?.airline || '').toLowerCase();
        const origin = (f.origin || '').toLowerCase();
        const dest = (f.destination || '').toLowerCase();
        const flightNumbers = (f.legs || []).map(l => (l.flightNumber || '').toLowerCase()).join(' ');

        const matches = pnr.includes(q) ||
          name.includes(q) ||
          agent.includes(q) ||
          airline.includes(q) ||
          origin.includes(q) ||
          dest.includes(q) ||
          flightNumbers.includes(q);

        if (!matches) return false;
      }

      // 2. Agent / Branch Filter
      if (selectedAgent) {
        const flightAgent = f.agent || f.company || 'Alsaadah Sharjah';
        if (selectedAgent === 'OTHER') {
          if (standardAgents.includes(flightAgent)) return false;
        } else {
          if (flightAgent.toLowerCase() !== selectedAgent.toLowerCase()) return false;
        }
      }

      // 3. Status Filter
      if (selectedStatus) {
        const status = f.status || 'Confirmed';
        if (status.toLowerCase() !== selectedStatus.toLowerCase()) return false;
      }

      // 4. Advanced filters: departure date, date added, airline, route
      const depTime = f.departureTime ? new Date(f.departureTime).getTime() : NaN;
      const depFrom = advFilter('filterDepFrom');
      const depTo = advFilter('filterDepTo');
      if (depFrom && !(depTime >= new Date(`${depFrom}T00:00:00`).getTime())) return false;
      if (depTo && !(depTime <= new Date(`${depTo}T23:59:59.999`).getTime())) return false;

      const addedTime = f.createdAt ? new Date(f.createdAt).getTime() : NaN;
      const addedFrom = advFilter('filterAddedFrom');
      const addedTo = advFilter('filterAddedTo');
      if (addedFrom && !(addedTime >= new Date(`${addedFrom}T00:00:00`).getTime())) return false;
      if (addedTo && !(addedTime <= new Date(`${addedTo}T23:59:59.999`).getTime())) return false;

      const airlineFilter = advFilter('filterAirline');
      if (airlineFilter && (f.airline || f.legs?.[0]?.airline || '').toLowerCase() !== airlineFilter.toLowerCase()) return false;

      // Route filters match the airport code or city text
      const originFilter = advFilter('filterOrigin').toLowerCase();
      const destFilter = advFilter('filterDest').toLowerCase();
      if (originFilter && !(f.origin || '').toLowerCase().includes(originFilter)) return false;
      if (destFilter && !(f.destination || '').toLowerCase().includes(destFilter)) return false;

      return true;
    });

    // Active-filter count on the Filters button (advanced filters + agent/status)
    const activeCount = [selectedAgent, selectedStatus, ...filterIds.map(advFilter)].filter(Boolean).length;
    const badge = document.getElementById('activeFiltersBadge');
    if (badge) {
      badge.textContent = activeCount;
      badge.classList.toggle('hidden', activeCount === 0);
    }

    const getSaveTime = (doc) => {
      if (doc.createdAt) {
        const t = new Date(doc.createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (doc._id) {
        const idStr = String(doc._id);
        if (idStr.length >= 8) {
          const parsed = parseInt(idStr.substring(0, 8), 16) * 1000;
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
      }
      return 0;
    };

    // 4. Sorting (Newly saved flights appear strictly on top by default)
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest': {
          const timeA = getSaveTime(a);
          const timeB = getSaveTime(b);
          if (timeA !== timeB) return timeA - timeB;
          return String(a._id || '').localeCompare(String(b._id || ''));
        }
        case 'passengerAsc':
          return (a.passengerName || '').localeCompare(b.passengerName || '');
        case 'departureAsc':
          return new Date(a.departureTime || 0) - new Date(b.departureTime || 0);
        case 'marginDesc': {
          const marginA = (Number(a.sellingPrice) || 0) - (Number(a.actualCost) || 0);
          const marginB = (Number(b.sellingPrice) || 0) - (Number(b.actualCost) || 0);
          return marginB - marginA;
        }
        case 'priceDesc':
          return (Number(b.sellingPrice) || 0) - (Number(a.sellingPrice) || 0);
        case 'newest':
        default: {
          const timeA = getSaveTime(a);
          const timeB = getSaveTime(b);
          if (timeB !== timeA) return timeB - timeA;
          return String(b._id || '').localeCompare(String(a._id || ''));
        }
      }
    });

    lastFiltered = filtered;

    // Update Counter Badge
    if (countBadge) {
      if (isFiltered) {
        countBadge.textContent = `Showing ${filtered.length} of ${cachedFlights.length} travellers`;
      } else {
        countBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'traveller' : 'travellers'}`;
      }
    }

    // Render Table
    window.UI.renderSavedFlightsTable(filtered, {
      onSelect: (flight) => {
        window.UI.displayFlightOutcome(flight);
      },
      onEdit: (flight) => {
        window.UI.openEditModal(flight, async (id, updates) => {
          await window.API.updateFlight(id, updates);
          window.UI.showAlert('success', 'Updated Successfully', `Record for ${updates.passengerName || updates.bookingReference} saved.`);
          await loadFlights();
          if (window.Accounts) window.Accounts.refresh();
          window.UI.displayFlightOutcome({ ...flight, ...updates });
        });
      },
      onDelete: async (flight) => {
        if (confirm(`Delete traveller record for ${flight.passengerName || flight.bookingReference}?`)) {
          try {
            await window.API.deleteFlight(flight._id || flight.bookingReference);
            window.UI.showAlert('success', 'Traveller Deleted', `Record ${flight.bookingReference} removed.`);
            await loadFlights();
          } catch (err) {
            window.UI.showAlert('error', 'Delete Failed', err.message);
          }
        }
      }
    });
  }

  // Keep the airline dropdown in sync with the airlines present in saved tickets
  function populateAirlineFilter() {
    const sel = document.getElementById('filterAirline');
    if (!sel) return;
    const current = sel.value;
    const airlines = [...new Set(cachedFlights.map((f) => f.airline || f.legs?.[0]?.airline).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    sel.innerHTML = '<option value="">All Airlines</option>' +
      airlines.map((a) => `<option value="${window.UI.esc(a)}">${window.UI.esc(a)}</option>`).join('');
    sel.value = airlines.includes(current) ? current : '';
  }

  // Show / hide the advanced filters panel
  document.getElementById('toggleFiltersBtn')?.addEventListener('click', () => {
    document.getElementById('advancedFilters')?.classList.toggle('hidden');
  });

  // Download the currently filtered list as CSV (opens in Excel)
  document.getElementById('downloadFlightsBtn')?.addEventListener('click', () => {
    if (!lastFiltered.length) {
      window.UI.showAlert('info', 'Nothing to Download', 'No travellers match the current filters.');
      return;
    }
    const cell = (v) => {
      let t = String(v ?? '');
      if (/^[=+\-@]/.test(t)) t = `'${t}`; // stop spreadsheet formula injection
      return `"${t.replace(/"/g, '""')}"`;
    };
    const iso = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '');
    const rows = [['Agent', 'PNR', 'Passenger', 'Airline', 'Origin', 'Destination', 'Departure', 'Arrival', 'Status', 'Cost (AED)', 'Selling (AED)', 'Profit (AED)', 'Added By', 'Date Added']];
    lastFiltered.forEach((f) => {
      const cost = Number(f.actualCost) || 0;
      const price = Number(f.sellingPrice) || 0;
      rows.push([
        f.agent || f.company || '', f.bookingReference, f.passengerName,
        f.airline || f.legs?.[0]?.airline || '', f.origin, f.destination,
        iso(f.departureTime), iso(f.arrivalTime), f.status || 'Confirmed',
        cost, price, price - cost, f.addedBy || '', iso(f.createdAt)
      ]);
    });
    const blob = new Blob(['\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `saved_travellers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // Filter & Search Event Listeners
  if (searchInput) searchInput.addEventListener('input', applyFlightFilter);
  if (filterAgent) filterAgent.addEventListener('change', applyFlightFilter);
  if (filterStatus) filterStatus.addEventListener('change', applyFlightFilter);
  if (filterSort) filterSort.addEventListener('change', applyFlightFilter);
  filterIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change', applyFlightFilter);
  });

  // Clear Search Input Button
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      applyFlightFilter();
      searchInput.focus();
    });
  }

  // Reset All Filters Button
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (filterAgent) filterAgent.value = '';
      if (filterStatus) filterStatus.value = '';
      if (filterSort) filterSort.value = 'newest';
      filterIds.forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
      applyFlightFilter();
    });
  }

  // Form Submission: Extract & Save Flight
  if (intakeForm) {
    intakeForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!currentFile) {
        window.UI.showAlert('error', 'File Missing', 'Please select or drag-and-drop a ticket PDF or document first.');
        return;
      }

      // Read selected agent
      const selectedAgent = agentSelect?.value === 'OTHER'
        ? (agentCustom?.value.trim() || 'Other')
        : (agentSelect?.value || 'Alsaadah Sharjah');

      const actualCost = actualCostInput?.value || 0;
      const sellingPrice = sellingPriceInput?.value || 0;

      extractBtn.disabled = true;
      extractBtnText.textContent = 'Extracting details...';
      extractSpinner.classList.remove('hidden');
      window.UI.hideAlert();

      try {
        const result = await window.API.uploadTicket(currentFile, {
          agent: selectedAgent,
          company: selectedAgent,
          actualCost,
          sellingPrice
        });

        window.UI.showAlert('success', 'Extraction Completed', `Ticket ${result.bookingReference || ''} saved under ${selectedAgent}.`);
        window.UI.displayFlightOutcome(result);
        if (searchInput) searchInput.value = '';
        if (filterAgent) filterAgent.value = '';
        if (filterStatus) filterStatus.value = '';
        if (filterSort) filterSort.value = 'newest';
        filterIds.forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
        resetFileSelection();
        await loadFlights();
        if (window.Accounts) window.Accounts.refresh();
      } catch (err) {
        console.error('Extraction error:', err);
        window.UI.showAlert('error', 'Extraction Failed', err.message);
      } finally {
        extractBtn.disabled = false;
        extractBtnText.textContent = 'Extract & Save Flight';
        extractSpinner.classList.add('hidden');
      }
    });
  }

  // Refresh DB Button
  if (refreshDbBtn) {
    refreshDbBtn.addEventListener('click', async () => {
      await loadFlights();
      window.UI.showAlert('info', 'Refreshed', 'Database synchronized from MongoDB Atlas.');
    });
  }

  // Toggle API Target
  if (toggleApiBtn) {
    toggleApiBtn.addEventListener('click', async () => {
      window.CONFIG.toggleApi();
      const isOnline = await window.API.checkHealth();
      window.UI.updateGatewayBadge(isOnline, window.CONFIG.isLocal());
      window.UI.showAlert('info', 'API Target Changed', `Now connecting to: ${window.CONFIG.getApiUrl()}`);
      await loadFlights();
    });
  }

  // Copy PNR
  if (copyPnrBtn) {
    copyPnrBtn.addEventListener('click', () => {
      const pnr = document.getElementById('outcomePnr')?.textContent;
      if (pnr && pnr !== '------') {
        navigator.clipboard.writeText(pnr);
        if (copySuccessBadge) {
          copySuccessBadge.classList.remove('hidden');
          setTimeout(() => copySuccessBadge.classList.add('hidden'), 2000);
        }
      }
    });
  }

  // Close Edit Modal buttons
  if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', window.UI.closeEditModal);
  if (cancelEditModalBtn) cancelEditModalBtn.addEventListener('click', window.UI.closeEditModal);

  // Close modal when clicking outside content
  const editModal = document.getElementById('editFlightModal');
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) window.UI.closeEditModal();
    });
  }

  // Initial Boot: fetch real data from Atlas, no demo data
  loadFlights();
});
