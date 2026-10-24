// Faroway ticket generator: upload a ticket, preview the Faroway e-ticket, download it as PDF

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  if (!$('ticketGenSection')) return;

  let current = null; // { fileName, html }

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
    const file = $('tgFile').files[0];
    showError('');
    if (!file) {
      showError('Choose a ticket PDF or image first.');
      return;
    }
    const btn = $('tgGenerateBtn');
    btn.disabled = true;
    $('tgSpinner').classList.remove('hidden');
    $('tgGenerateText').textContent = 'Generating...';
    try {
      const result = await window.API.generateTicket(file);
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
