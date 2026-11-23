// Faroway ticket generator: upload a ticket, preview the Faroway e-ticket, download it as PDF

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  if (!$('ticketGenSection')) return;

  let current = null; // { fileName, html }
  const MAX_FILES = 10; // the server accepts up to 10 documents per ticket
  let picked = []; // every file chosen so far; each pick adds to the list instead of replacing it

  const sizeLabel = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  const esc = (v) => window.UI.esc(v);

  function renderFiles() {
    const list = $('tgFileList');
    list.classList.toggle('hidden', !picked.length);
    list.innerHTML = picked.map((f, i) => `<li class="flex items-center gap-2 px-3 h-9 rounded-lg bg-slate-50 border border-slate-200 text-xs">
      <span class="material-symbols-outlined text-[16px] text-slate-400">description</span>
      <span class="font-semibold text-slate-700 truncate min-w-0 flex-1">${esc(f.name)}</span>
      <span class="font-mono text-slate-400 shrink-0">${sizeLabel(f.size)}</span>
      <button type="button" data-rm="${i}" aria-label="Remove ${esc(f.name)}" class="shrink-0 w-6 h-6 -mr-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"><span class="material-symbols-outlined text-[16px]">close</span></button>
    </li>`).join('');
  }

  $('tgFile').addEventListener('change', (e) => {
    const same = (a, b) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
    let skipped = 0;
    for (const f of e.target.files) {
      if (picked.some((p) => same(p, f))) continue;
      if (picked.length >= MAX_FILES) { skipped++; continue; }
      picked.push(f);
    }
    e.target.value = ''; // so choosing the same file again later still fires
    showError(skipped ? `Only ${MAX_FILES} files can go into one ticket; ${skipped} not added.` : '');
    renderFiles();
  });
  $('tgFileList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    picked.splice(Number(b.dataset.rm), 1);
    showError('');
    renderFiles();
  });

  const showError = (msg) => {
    $('tgError').textContent = msg;
    $('tgError').classList.toggle('hidden', !msg);
  };

  const iframeReady = (frame) => new Promise((resolve) => {
    frame.onload = () => resolve(frame.contentDocument);
  });

  // Size the preview to the whole ticket and scale it down to the available width (phones)
  function fitPreview() {
    const frame = $('tgPreview');
    const doc = frame.contentDocument;
    if (!doc || !doc.body) return;
    frame.style.transform = 'none';
    frame.style.height = '100px';
    const height = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 400);
    const available = $('tgFrame').clientWidth - 24;
    if (available <= 0) return;
    const scale = Math.min(1, available / 794);
    frame.style.height = `${height}px`;
    frame.style.transform = `scale(${scale})`;
    $('tgScale').style.width = `${794 * scale}px`;
    $('tgScale').style.height = `${height * scale}px`;
  }
  window.addEventListener('resize', fitPreview);

  $('tgGenerateBtn').addEventListener('click', async () => {
    const files = picked.slice();
    showError('');
    if (!files.length) {
      showError('Choose a ticket PDF or image first.');
      return;
    }
    const btn = $('tgGenerateBtn');
    btn.disabled = true;
    $('tgSpinner').classList.remove('hidden');
    $('tgGenerateText').textContent = 'Generating...';
    try {
      const result = await window.API.generateTicket(files);
      current = { fileName: result.fileName, html: result.html };
      const frame = $('tgPreview');
      const ready = iframeReady(frame);
      frame.srcdoc = result.html;
      const doc = await ready;
      $('tgFileName').textContent = `${result.fileName}.pdf`;
      $('tgResult').classList.remove('hidden');
      fitPreview();
      $('tgResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
      $('tgSpinner').classList.add('hidden');
      $('tgGenerateText').textContent = 'Generate Ticket';
    }
  });

  // html2canvas cannot read inside an iframe, so the download renders the ticket in a hidden container on
  // this page. The ticket's CSS is scoped to that container so it cannot restyle the rest of the app.
  function buildOffscreenTicket(html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(parsed.querySelector('style')?.textContent || '');
    const scope = '#tgOffscreen';
    let css = '';
    for (const rule of sheet.cssRules) {
      if (!(rule instanceof CSSStyleRule)) continue; // skips @page
      const selectors = rule.selectorText.split(',').map((sel) => {
        sel = sel.trim();
        if (sel === '*') return `${scope}, ${scope} *`;
        if (sel === 'body') return scope;
        return `${scope} ${sel}`;
      }).join(', ');
      css += `${selectors} { ${rule.style.cssText} }\n`;
    }
    const host = document.createElement('div');
    host.id = 'tgOffscreen';
    // On-screen but behind the page: html2canvas skips content positioned outside the viewport
    host.style.cssText = 'position:absolute;left:0;top:0;width:794px;background:#fff;z-index:-1;pointer-events:none;';
    host.innerHTML = `<style>${css}</style>${parsed.body.innerHTML}`;
    document.body.appendChild(host);
    return host;
  }

  $('tgPrintBtn').addEventListener('click', () => {
    const frame = $('tgPreview');
    frame.contentWindow.focus();
    frame.contentWindow.print();
  });

  $('tgDownloadBtn').addEventListener('click', async () => {
    if (!current) return;
    const btn = $('tgDownloadBtn');
    btn.disabled = true;
    $('tgDownloadText').textContent = 'Preparing PDF...';
    let host = null;
    try {
      if (!window.html2canvas || !window.jspdf) throw new Error('PDF tool failed to load. Use Print and choose "Save as PDF".');
      host = buildOffscreenTicket(current.html);
      const canvas = await window.html2canvas(host, { scale: 2, backgroundColor: '#ffffff', useCORS: true });

      // A4 portrait with 10mm side and 12mm top/bottom margins; taller tickets continue on extra pages
      const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = 210, pageH = 297, mx = 10, my = 12;
      const imgW = pageW - mx * 2;
      const pxPerMm = canvas.width / imgW;
      const sliceHpx = Math.floor((pageH - my * 2) * pxPerMm);
      for (let y = 0, page = 0; y < canvas.height; y += sliceHpx, page++) {
        const h = Math.min(sliceHpx, canvas.height - y);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = h;
        const ctx = slice.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.98), 'JPEG', mx, my, imgW, h / pxPerMm);
      }
      pdf.save(`${current.fileName}.pdf`);
    } catch (err) {
      showError(err.message);
    } finally {
      host?.remove();
      btn.disabled = false;
      $('tgDownloadText').textContent = 'Download PDF';
    }
  });
});
