// AeroLedger DB — UI Renderer & Modal Management

const UI = {
  // Agent / Branch styling helper
  getAgentBadge(agentName = '') {
    const lower = (agentName || '').toLowerCase();
    if (lower.includes('sharjah')) return { name: 'Alsaadah Sharjah', dot: 'bg-sky-500', badgeBg: 'bg-sky-50', badgeBorder: 'border-sky-200', badgeText: 'text-sky-800' };
    if (lower.includes('dubai')) return { name: 'Alsaadah Dubai', dot: 'bg-emerald-500', badgeBg: 'bg-emerald-50', badgeBorder: 'border-emerald-200', badgeText: 'text-emerald-800' };
    if (lower.includes('sajja')) return { name: 'Alsaadah Sajja', dot: 'bg-amber-500', badgeBg: 'bg-amber-50', badgeBorder: 'border-amber-200', badgeText: 'text-amber-800' };
    return { name: agentName || 'Alsaadah Sharjah', dot: 'bg-indigo-500', badgeBg: 'bg-indigo-50', badgeBorder: 'border-indigo-200', badgeText: 'text-indigo-800' };
  },

  // Airline color coding helper
  getAirlineColor(airlineName = '') {
    const lower = (airlineName || '').toLowerCase();
    if (lower.includes('emirates')) return '#059669';
    if (lower.includes('delta')) return '#ba1a1a';
    if (lower.includes('united')) return '#006194';
    if (lower.includes('lufthansa')) return '#3b82f6';
    if (lower.includes('air india')) return '#dc2626';
    if (lower.includes('singapore')) return '#0284c7';
    if (lower.includes('qatar')) return '#881337';
    if (lower.includes('british')) return '#1e40af';
    return '#6366f1';
  },

  // Format ISO timestamps into clean time and date
  formatDateTime(isoString) {
    if (!isoString) return { time: '--:--', date: 'N/A' };
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return { time: isoString, date: '' };
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const date = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      return { time, date };
    } catch {
      return { time: isoString, date: '' };
    }
  },

  // Calculate duration string between two timestamps
  getDurationString(startIso, endIso) {
    try {
      const start = new Date(startIso).getTime();
      const end = new Date(endIso).getTime();
      if (isNaN(start) || isNaN(end) || end < start) return null;

      const diffMs = end - start;
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      if (hours === 0) return `${minutes}m`;
      return `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`.trim();
    } catch {
      return null;
    }
  },

  // Financial margin computation
  calculateMargin(cost, price) {
    const c = parseFloat(cost) || 0;
    const p = parseFloat(price) || 0;
    const diff = p - c;
    const percent = c > 0 ? ((diff / c) * 100).toFixed(1) : 0;
    return {
      diff,
      percent,
      isPositive: diff >= 0
    };
  },

  // Show status banner notification
  showAlert(type, title, message) {
    const alertBanner = document.getElementById('alertBanner');
    if (!alertBanner) return;

    const alertIcon = document.getElementById('alertIcon');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');

    alertBanner.className = 'p-4 rounded-xl border text-sm flex items-start gap-3 transition-all mb-4 shadow-sm';
    if (type === 'error') {
      alertBanner.classList.add('bg-rose-50', 'border-rose-200', 'text-rose-900');
      alertIcon.innerHTML = `<span class="material-symbols-outlined text-rose-600 text-[20px]">error</span>`;
    } else if (type === 'success') {
      alertBanner.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-900');
      alertIcon.innerHTML = `<span class="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>`;
    } else {
      alertBanner.classList.add('bg-sky-50', 'border-sky-200', 'text-sky-900');
      alertIcon.innerHTML = `<span class="material-symbols-outlined text-sky-600 text-[20px]">info</span>`;
    }

    if (alertTitle) alertTitle.textContent = title;
    if (alertMessage) alertMessage.textContent = message;
    alertBanner.classList.remove('hidden');
  },

  hideAlert() {
    const alertBanner = document.getElementById('alertBanner');
    if (alertBanner) alertBanner.classList.add('hidden');
  },

  // Top Gateway Status Indicator
  updateGatewayBadge(isOnline, isLocal) {
    const dot = document.getElementById('gatewayStatusDot');
    const text = document.getElementById('gatewayStatusText');
    const targetBadge = document.getElementById('apiTargetBadge');

    if (dot && text) {
      if (isOnline) {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse';
        text.textContent = 'GATEWAY ONLINE';
        text.parentElement.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/60';
      } else {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-400';
        text.textContent = 'GATEWAY OFFLINE';
        text.parentElement.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-rose-950/60 text-rose-400 border border-rose-800/60';
      }
    }

    if (targetBadge) {
      targetBadge.textContent = isLocal ? 'Local: 3000' : 'Cloud: Atlas';
    }
  },

  // Render Saved Flights Table in Section 3
  renderSavedFlightsTable(flights, { onSelect, onEdit, onDelete }) {
    const tbody = document.getElementById('savedFlightsTableBody');
    const countBadge = document.getElementById('savedFlightsCountBadge');
    if (!tbody) return;

    if (countBadge) {
      countBadge.textContent = `${flights.length} ${flights.length === 1 ? 'entry' : 'entries'}`;
    }

    if (!flights || flights.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="px-5 py-8 text-center text-slate-500 text-sm">
            <span class="material-symbols-outlined text-slate-400 text-[28px] mb-1">person_search</span>
            <p class="font-medium text-slate-700">No matching traveller or flight records found.</p>
            <p class="text-xs text-slate-400 mt-0.5">Upload a ticket PDF above to start tracking or adjust your search filters.</p>
          </td>
        </tr>
      `;
      return;
    }

    flights.forEach((flight) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/80 transition-colors group cursor-pointer';

      const agent = flight.agent || flight.company || 'Alsaadah Sharjah';
      const agentBadge = UI.getAgentBadge(agent);
      const airline = flight.airline || flight.legs?.[0]?.airline || 'Airline';
      const airlineColor = UI.getAirlineColor(airline);
      const dep = UI.formatDateTime(flight.departureTime);
      const cost = Number(flight.actualCost) || 0;
      const price = Number(flight.sellingPrice) || 0;
      const margin = UI.calculateMargin(cost, price);

      tr.innerHTML = `
        <!-- Agent / Branch -->
        <td class="px-5 py-3">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 ${agentBadge.dot}"></span>
            <div class="min-w-0">
              <span class="text-slate-900 font-bold text-xs sm:text-sm block truncate">${agent}</span>
              <span class="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5 truncate">
                <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${airlineColor}"></span>
                ${airline}
              </span>
            </div>
          </div>
        </td>

        <!-- Booking Reference PNR -->
        <td class="px-5 py-3 font-mono font-bold text-xs text-sky-600">
          <span class="px-2 py-0.5 rounded bg-sky-50 border border-sky-200">
            ${flight.bookingReference || 'N/A'}
          </span>
        </td>

        <!-- Passenger & Route -->
        <td class="px-5 py-3">
          <div class="text-xs font-semibold text-slate-800 uppercase truncate max-w-[180px]">${flight.passengerName || 'Passenger'}</div>
          <div class="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
            <span class="truncate">${flight.origin || '---'}</span>
            <span class="material-symbols-outlined text-[12px] text-slate-400">arrow_forward</span>
            <span class="truncate">${flight.destination || '---'}</span>
          </div>
        </td>

        <!-- Departure Date -->
        <td class="px-5 py-3 font-mono text-xs text-slate-600">
          <div>${dep.date}</div>
          <div class="text-[11px] text-slate-400">${dep.time}</div>
        </td>

        <!-- Actual Cost -->
        <td class="px-5 py-3 text-right font-mono text-slate-700 font-medium text-xs sm:text-sm">
          $${cost.toFixed(2)}
        </td>

        <!-- Selling Price -->
        <td class="px-5 py-3 text-right font-mono text-slate-900 font-bold text-xs sm:text-sm">
          $${price.toFixed(2)}
        </td>

        <!-- Margin -->
        <td class="px-5 py-3 text-center">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${margin.isPositive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
            ${margin.isPositive ? '+' : ''}$${margin.diff.toFixed(2)} (${margin.percent}%)
          </span>
        </td>

        <!-- Status -->
        <td class="px-5 py-3 text-center">
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
            <span class="w-1 h-1 rounded-full bg-emerald-500"></span> ${flight.status || 'Confirmed'}
          </span>
        </td>

        <!-- Actions -->
        <td class="px-5 py-3 text-right">
          <div class="flex items-center justify-end gap-1">
            <button class="view-flight-btn p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="View Itinerary">
              <span class="material-symbols-outlined text-[18px]">visibility</span>
            </button>
            <button class="edit-flight-btn p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Flight Details">
              <span class="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button class="delete-flight-btn p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Flight">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </td>
      `;

      // Event listeners for actions
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (onSelect) onSelect(flight);
      });

      const viewBtn = tr.querySelector('.view-flight-btn');
      if (viewBtn) {
        viewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onSelect) onSelect(flight);
        });
      }

      const editBtn = tr.querySelector('.edit-flight-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onEdit) onEdit(flight);
        });
      }

      const delBtn = tr.querySelector('.delete-flight-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onDelete) onDelete(flight);
        });
      }

      tbody.appendChild(tr);
    });
  },

  // Display single flight details in Agent Extraction Outcome (Section 2)
  displayFlightOutcome(data) {
    if (!data) return;

    const outcomeSection = document.getElementById('extractionResultsSection');
    if (outcomeSection) outcomeSection.classList.remove('hidden');

    // Header & Badges
    const pnrEl = document.getElementById('outcomePnr');
    const passengerEl = document.getElementById('outcomePassenger');
    const originCodeEl = document.getElementById('outcomeOriginCode');
    const originCityEl = document.getElementById('outcomeOriginCity');
    const depTimeEl = document.getElementById('outcomeDepTime');
    const destCodeEl = document.getElementById('outcomeDestCode');
    const destCityEl = document.getElementById('outcomeDestCity');
    const arrTimeEl = document.getElementById('outcomeArrTime');
    const durationEl = document.getElementById('outcomeDuration');
    const legsBadgeEl = document.getElementById('outcomeLegsBadge');
    const routeTypeEl = document.getElementById('outcomeRouteType');

    if (pnrEl) pnrEl.textContent = data.bookingReference || '------';
    if (passengerEl) passengerEl.textContent = data.passengerName || 'UNSPECIFIED PASSENGER';

    // Route Origin
    const originStr = data.origin || '';
    const originMatch = originStr.match(/\b([A-Z]{3})\b/);
    const originCode = originMatch ? originMatch[1] : (originStr.slice(0, 3).toUpperCase() || 'ORG');
    const originCity = originStr.replace(originCode, '').replace(/[,\(\)]/g, '').trim() || originStr;
    if (originCodeEl) originCodeEl.textContent = originCode;
    if (originCityEl) originCityEl.textContent = originCity;

    // Route Destination
    const destStr = data.destination || '';
    const destMatch = destStr.match(/\b([A-Z]{3})\b/);
    const destCode = destMatch ? destMatch[1] : (destStr.slice(0, 3).toUpperCase() || 'DST');
    const destCity = destStr.replace(destCode, '').replace(/[,\(\)]/g, '').trim() || destStr;
    if (destCodeEl) destCodeEl.textContent = destCode;
    if (destCityEl) destCityEl.textContent = destCity;

    // Times & Duration
    const depFormatted = UI.formatDateTime(data.departureTime);
    const arrFormatted = UI.formatDateTime(data.arrivalTime);
    if (depTimeEl) depTimeEl.innerHTML = `<span class="font-bold">${depFormatted.time}</span> <span class="text-slate-400 font-normal">(${depFormatted.date})</span>`;
    if (arrTimeEl) arrTimeEl.innerHTML = `<span class="font-bold">${arrFormatted.time}</span> <span class="text-slate-400 font-normal">(${arrFormatted.date})</span>`;

    const totalDuration = UI.getDurationString(data.departureTime, data.arrivalTime);
    if (durationEl) durationEl.textContent = totalDuration ? `${totalDuration} Total` : 'Duration N/A';

    const legs = data.legs || [];
    if (legsBadgeEl) legsBadgeEl.textContent = `${legs.length} ${legs.length === 1 ? 'Flight Leg' : 'Flight Legs'}`;
    if (routeTypeEl) routeTypeEl.textContent = legs.length <= 1 ? 'Direct Route' : `${legs.length - 1} Connection(s)`;

    // Financial Overview & Agent in outcome card
    const cost = Number(data.actualCost) || 0;
    const price = Number(data.sellingPrice) || 0;
    const margin = UI.calculateMargin(cost, price);
    const agent = data.agent || data.company || 'Alsaadah Sharjah';
    const financeBadge = document.getElementById('outcomeFinanceBadge');
    if (financeBadge) {
      financeBadge.innerHTML = `
        <span class="inline-flex items-center gap-1 text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded font-bold">
          <span class="material-symbols-outlined text-[14px]">support_agent</span> ${agent}
        </span>
        <span class="text-slate-300">|</span>
        <span class="text-slate-500 font-medium">Cost: <strong class="text-slate-800 font-mono">$${cost.toFixed(2)}</strong></span>
        <span class="text-slate-300">|</span>
        <span class="text-slate-500 font-medium">Selling: <strong class="text-slate-800 font-mono">$${price.toFixed(2)}</strong></span>
        <span class="text-slate-300">|</span>
        <span class="${margin.isPositive ? 'text-emerald-700' : 'text-rose-600'} font-bold font-mono">
          Profit: ${margin.isPositive ? '+' : ''}$${margin.diff.toFixed(2)} (${margin.percent}%)
        </span>
      `;
    }

    // Baggage Info
    const cabinEl = document.getElementById('outcomeCabinBaggage');
    const checkInEl = document.getElementById('outcomeCheckInBaggage');
    if (cabinEl) cabinEl.textContent = data.baggage?.cabin || 'Not specified';
    if (checkInEl) checkInEl.textContent = data.baggage?.checkIn || 'Not specified';

    // Itinerary & Connections Timeline
    const container = document.getElementById('outcomeLegsContainer');
    if (container) {
      container.innerHTML = '';
      legs.forEach((leg, index) => {
        const legDep = UI.formatDateTime(leg.departureDateTime);
        const legArr = UI.formatDateTime(leg.arrivalDateTime);
        const legDuration = UI.getDurationString(leg.departureDateTime, leg.arrivalDateTime);

        const card = document.createElement('div');
        card.className = "border border-slate-200 rounded-xl p-4 sm:p-5 bg-slate-50/50 flex flex-col gap-4";

        card.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center text-xs font-mono font-bold">${index + 1}</div>
              <span class="material-symbols-outlined text-sky-600 text-[20px]">flight</span>
              <span class="font-bold text-slate-900 text-sm sm:text-base">${leg.airline || data.airline || 'Airline'}</span>
              <span class="text-xs font-mono font-bold bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-0.5 rounded-md">${leg.flightNumber || 'FLIGHT'}</span>
            </div>
            ${legDuration ? `
              <span class="text-xs font-mono text-slate-500 flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                <span class="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                ${legDuration} Duration
              </span>
            ` : ''}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-slate-200/80">
            <!-- Departure -->
            <div class="flex flex-col gap-1">
              <div class="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">DEPARTURE</div>
              <div class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-sky-600 text-[18px]">flight_takeoff</span>
                <span>${leg.fromAirport}</span>
              </div>
              <div class="text-xs font-mono text-slate-600 pl-6 font-medium">
                ${legDep.time} ${legDep.date}
                ${leg.departureTerminal ? `<span class="ml-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">T${leg.departureTerminal}</span>` : ''}
              </div>
            </div>

            <!-- Arrival -->
            <div class="flex flex-col gap-1 sm:border-l sm:border-slate-100 sm:pl-4">
              <div class="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">ARRIVAL</div>
              <div class="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-emerald-600 text-[18px]">flight_land</span>
                <span>${leg.toAirport}</span>
              </div>
              <div class="text-xs font-mono text-slate-600 pl-6 font-medium">
                ${legArr.time} ${legArr.date}
                ${leg.arrivalTerminal ? `<span class="ml-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">T${leg.arrivalTerminal}</span>` : ''}
              </div>
            </div>
          </div>
        `;

        container.appendChild(card);

        // Layover if multiple legs
        if (index < legs.length - 1) {
          const nextLeg = legs[index + 1];
          const layoverDur = UI.getDurationString(leg.arrivalDateTime, nextLeg.departureDateTime);
          const layoverEl = document.createElement('div');
          layoverEl.className = "flex items-center justify-center";
          layoverEl.innerHTML = `
            <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-mono font-medium shadow-xs">
              <span class="material-symbols-outlined text-[16px] text-amber-600">hourglass_top</span>
              <span>Layover at <strong>${leg.toAirport}</strong>: <span class="font-bold">${layoverDur || 'Connection'}</span></span>
            </div>
          `;
          container.appendChild(layoverEl);
        }
      });
    }

    // Raw JSON inspection
    const rawJsonEl = document.getElementById('outcomeRawJson');
    if (rawJsonEl) {
      rawJsonEl.textContent = JSON.stringify(data, null, 2);
    }

    // Scroll smoothly to outcome
    outcomeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // Open Edit Flight Modal
  openEditModal(flight, onSaveCallback) {
    const modal = document.getElementById('editFlightModal');
    if (!modal) return;

    // Fill form fields
    document.getElementById('editFlightId').value = flight._id || flight.bookingReference;
    document.getElementById('editPnr').value = flight.bookingReference || '';
    document.getElementById('editPassengerName').value = flight.passengerName || '';
    document.getElementById('editAirline').value = flight.airline || flight.legs?.[0]?.airline || '';
    
    // Agent Selection handling
    const currentAgent = flight.agent || flight.company || 'Alsaadah Sharjah';
    const editAgentSelect = document.getElementById('editAgentSelect');
    const editAgentCustom = document.getElementById('editAgentCustom');
    const standardAgents = ['Alsaadah Sharjah', 'Alsaadah Dubai', 'Alsaadah Sajja'];

    if (standardAgents.includes(currentAgent)) {
      editAgentSelect.value = currentAgent;
      editAgentCustom.classList.add('hidden');
      editAgentCustom.value = '';
    } else {
      editAgentSelect.value = 'OTHER';
      editAgentCustom.classList.remove('hidden');
      editAgentCustom.value = currentAgent;
    }

    editAgentSelect.onchange = () => {
      if (editAgentSelect.value === 'OTHER') {
        editAgentCustom.classList.remove('hidden');
        editAgentCustom.focus();
      } else {
        editAgentCustom.classList.add('hidden');
      }
    };

    document.getElementById('editActualCost').value = flight.actualCost !== undefined ? flight.actualCost : '';
    document.getElementById('editSellingPrice').value = flight.sellingPrice !== undefined ? flight.sellingPrice : '';
    document.getElementById('editOrigin').value = flight.origin || '';
    document.getElementById('editDestination').value = flight.destination || '';
    document.getElementById('editDepartureTime').value = flight.departureTime ? new Date(flight.departureTime).toISOString().slice(0, 16) : '';
    document.getElementById('editArrivalTime').value = flight.arrivalTime ? new Date(flight.arrivalTime).toISOString().slice(0, 16) : '';
    document.getElementById('editStatus').value = flight.status || 'Confirmed';
    document.getElementById('editCabinBaggage').value = flight.baggage?.cabin || '';
    document.getElementById('editCheckInBaggage').value = flight.baggage?.checkIn || '';

    // Update margin preview inside modal
    const costInput = document.getElementById('editActualCost');
    const priceInput = document.getElementById('editSellingPrice');
    const modalMarginDisplay = document.getElementById('modalMarginDisplay');

    function updateModalMargin() {
      const res = UI.calculateMargin(costInput.value, priceInput.value);
      if (res.isPositive) {
        modalMarginDisplay.textContent = `+$${res.diff.toFixed(2)} (+${res.percent}%)`;
        modalMarginDisplay.className = 'text-emerald-700 font-mono font-bold';
      } else {
        modalMarginDisplay.textContent = `-$${Math.abs(res.diff).toFixed(2)} (${res.percent}%)`;
        modalMarginDisplay.className = 'text-rose-600 font-mono font-bold';
      }
    }

    costInput.oninput = updateModalMargin;
    priceInput.oninput = updateModalMargin;
    updateModalMargin();

    // Bind form submit
    const form = document.getElementById('editFlightForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const finalAgent = editAgentSelect.value === 'OTHER'
        ? (editAgentCustom.value.trim() || 'Other')
        : editAgentSelect.value;

      const updates = {
        bookingReference: document.getElementById('editPnr').value.trim(),
        passengerName: document.getElementById('editPassengerName').value.trim(),
        agent: finalAgent,
        company: finalAgent,
        airline: document.getElementById('editAirline').value.trim(),
        actualCost: parseFloat(document.getElementById('editActualCost').value) || 0,
        sellingPrice: parseFloat(document.getElementById('editSellingPrice').value) || 0,
        origin: document.getElementById('editOrigin').value.trim(),
        destination: document.getElementById('editDestination').value.trim(),
        status: document.getElementById('editStatus').value,
        baggage: {
          cabin: document.getElementById('editCabinBaggage').value.trim() || null,
          checkIn: document.getElementById('editCheckInBaggage').value.trim() || null
        }
      };

      const depVal = document.getElementById('editDepartureTime').value;
      if (depVal) updates.departureTime = new Date(depVal).toISOString();
      const arrVal = document.getElementById('editArrivalTime').value;
      if (arrVal) updates.arrivalTime = new Date(arrVal).toISOString();

      const saveBtn = document.getElementById('editSaveBtn');
      const saveBtnText = document.getElementById('editSaveBtnText');
      saveBtn.disabled = true;
      saveBtnText.textContent = 'Saving...';

      try {
        await onSaveCallback(flight._id || flight.bookingReference, updates);
        UI.closeEditModal();
      } catch (err) {
        alert(`Failed to save changes: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtnText.textContent = 'Save Changes';
      }
    };

    modal.classList.remove('hidden');
  },

  closeEditModal() {
    const modal = document.getElementById('editFlightModal');
    if (modal) modal.classList.add('hidden');
  }
};

window.UI = UI;
