import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Spinner } from '../components/ui.jsx';

// html2canvas cannot read inside an iframe, so the PDF is rendered from a hidden copy on the page.
// The ticket CSS is scoped to that copy so it cannot restyle the app.
function buildOffscreen(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(parsed.querySelector('style')?.textContent || '');
  const scope = '#ticketOffscreen';
  let css = '';
  for (const rule of sheet.cssRules) {
    if (!(rule instanceof CSSStyleRule)) continue; // skips @page
    const selectors = rule.selectorText.split(',').map((raw) => {
      const sel = raw.trim();
      if (sel === '*') return `${scope}, ${scope} *`;
      if (sel === 'body') return scope;
      return `${scope} ${sel}`;
    }).join(', ');
    css += `${selectors} { ${rule.style.cssText} }\n`;
  }
  const host = document.createElement('div');
  host.id = 'ticketOffscreen';
  host.style.cssText = 'position:absolute;left:0;top:0;width:794px;background:#fff;z-index:-1;pointer-events:none;';
  host.innerHTML = `<style>${css}</style>${parsed.body.innerHTML}`;
  document.body.appendChild(host);
  return host;
}

async function renderPdf(html) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const host = buildOffscreen(html);
  try {
    const canvas = await html2canvas(host, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = 210, pageH = 297, mx = 10, my = 12;
    const imgW = pageW - mx * 2;
    const pxPerMm = canvas.width / imgW;
    const sliceH = Math.floor((pageH - my * 2) * pxPerMm);
    for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
      const h = Math.min(sliceH, canvas.height - y);
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
    return pdf;
  } finally {
    host.remove();
  }
}

export default function Generator({ notify }) {
  const fileRef = useRef(null);
  const wrapRef = useRef(null);
  const frameRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState(null); // { fileName, html }
  const [box, setBox] = useState({ scale: 1, height: 1123 });

  const fit = () => {
    const doc = frameRef.current?.contentDocument;
    const wrap = wrapRef.current;
    if (!doc?.body || !wrap) return;
    const height = Math.max(doc.documentElement.scrollHeight, 400);
    const scale = Math.min(1, (wrap.clientWidth - 16) / 794);
    setBox({ scale, height });
  };

  useEffect(() => {
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const generate = async () => {
    setError('');
    if (!file) return setError('Choose a ticket PDF or photo first.');
    setBusy(true);
    try {
      const r = await api.generateTicket(file);
      setTicket({ fileName: r.fileName, html: r.html });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setPdfBusy(true);
    try {
      const pdf = await renderPdf(ticket.html);
      pdf.save(`${ticket.fileName}.pdf`);
    } catch (err) {
      notify(err.message || 'Could not create the PDF.', 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const share = async () => {
    setPdfBusy(true);
    try {
      const pdf = await renderPdf(ticket.html);
      const pdfFile = new File([pdf.output('blob')], `${ticket.fileName}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [pdfFile] })) await navigator.share({ files: [pdfFile], title: 'Faroway e-ticket' });
      else pdf.save(`${ticket.fileName}.pdf`);
    } catch (err) {
      if (err.name !== 'AbortError') notify(err.message || 'Could not share the PDF.', 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <>
      <h2 className="h1">Faroway e-ticket</h2>
      <p className="sub">Upload any airline ticket and get a Faroway Holidays e-ticket with no prices. Nothing is saved.</p>

      <div className="card">
        <input ref={fileRef} type="file" accept=".pdf,application/pdf,image/png,image/jpeg,image/webp" hidden
          onChange={(e) => { setFile(e.target.files[0] || null); setError(''); }} />
        <button className="btn ghost block" onClick={() => fileRef.current?.click()}>{file ? 'Change file' : 'Choose PDF or photo'}</button>
        {file && <p className="small bold ellipsis" style={{ margin: '8px 0 0' }}>{file.name}</p>}
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn block" onClick={generate} disabled={busy}>{busy ? <><Spinner /> Generating...</> : 'Generate ticket'}</button>

      {ticket && (
        <div style={{ marginTop: 16 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <button className="btn green grow" onClick={download} disabled={pdfBusy}>{pdfBusy ? <Spinner /> : null}Download PDF</button>
            <button className="btn ghost grow" onClick={share} disabled={pdfBusy}>Share</button>
          </div>
          <p className="small muted ellipsis">{ticket.fileName}.pdf</p>
          <p className="small muted">Check the details against the original ticket before sending it to a customer.</p>
          <div className="preview-wrap" ref={wrapRef}>
            <div style={{ width: 794 * box.scale, height: box.height * box.scale, margin: '0 auto' }}>
              <iframe ref={frameRef} title="Ticket preview" srcDoc={ticket.html} onLoad={fit}
                style={{ width: 794, height: box.height, transform: `scale(${box.scale})` }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
