// ─── Tamaños de impresora soportados ──────────────────────────────────────────
export const PRINTER_SIZES = {
  p80: {
    id: 'p80', label: 'Térmica 80mm',
    pageSize: '80mm auto', width: '80mm', margin: '4mm',
    fontBase: 13, fontItem: 15, fontMeta: 12, fontMesa: 20,
    fontTitulo: 15, fontNota: 11, fontFooter: 11,
    qtyWidth: 24, dividerPx: 2,
  },
  p58: {
    id: 'p58', label: 'Térmica 58mm',
    pageSize: '58mm auto', width: '58mm', margin: '2mm',
    fontBase: 11, fontItem: 13, fontMeta: 10, fontMesa: 16,
    fontTitulo: 13, fontNota: 10, fontFooter: 10,
    qtyWidth: 20, dividerPx: 1,
  },
};

/**
 * Genera e imprime un ticket de comanda para impresora térmica.
 *
 * @param {object} opts
 * @param {object} opts.mesa           - { numero, nombre, zona }
 * @param {object} opts.comanda        - { numero_comanda, personas }
 * @param {Array}  opts.items          - [{ nombre_producto, cantidad, notas, area_cocina }]
 * @param {string} [opts.empresaNombre]
 * @param {string} [opts.nombreMesero]
 * @param {string} [opts.titulo]       - 'COMANDA' | 'REIMPRESIÓN' etc.
 * @param {string} [opts.printerSize]  - 'p80' | 'p58' (default 'p80')
 */
export function imprimirComanda({
  mesa,
  comanda,
  items,
  empresaNombre = '',
  nombreMesero  = '',
  titulo        = 'COMANDA',
  printerSize   = 'p80',
}) {
  if (!items || items.length === 0) return;

  const sz = PRINTER_SIZES[printerSize] ?? PRINTER_SIZES.p80;

  const ahora   = new Date();
  const horaFmt  = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const fechaFmt = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });

  // ── Agrupar ítems por área de cocina ────────────────────────────────────────
  const porArea = {};
  items.forEach(item => {
    const area = item.area_cocina || 'Cocina general';
    if (!porArea[area]) porArea[area] = [];
    porArea[area].push(item);
  });
  const hayVariasAreas = Object.keys(porArea).length > 1;

  const areasHTML = Object.entries(porArea).map(([area, itemsArea]) => `
    ${hayVariasAreas ? `<div class="area-header">${area.toUpperCase()}</div>` : ''}
    ${itemsArea.map(item => `
      <div class="item">
        <span class="qty">${item.cantidad}×</span>
        <span class="name">${escHtml(item.nombre_producto)}</span>
      </div>
      ${item.notas ? `<div class="nota">↳ ${escHtml(item.notas)}</div>` : ''}
    `).join('')}
  `).join('<div class="sep-dashed"></div>');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Comanda</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: ${sz.fontBase}px;
    width: ${sz.width};
    max-width: ${sz.width};
    padding: ${sz.margin} 3mm;
    color: #000;
    background: #fff;
  }
  .center       { text-align: center; }
  .rest-name    { font-size: ${sz.fontMesa}px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
  .divider      { border-top: ${sz.dividerPx}px solid #000; margin: 5px 0; }
  .sep-dashed   { border-top: 1px dashed #555; margin: 6px 0; }
  .titulo-ticket {
    font-size: ${sz.fontTitulo}px; font-weight: bold; text-align: center;
    letter-spacing: 3px; padding: 3px 0;
    border-top: ${sz.dividerPx}px solid #000; border-bottom: ${sz.dividerPx}px solid #000;
    margin: 4px 0;
  }
  .meta-row     { font-size: ${sz.fontMeta}px; margin-bottom: 3px; }
  .mesa-num     { font-size: ${sz.fontMesa}px; font-weight: bold; }
  .area-header  {
    font-size: ${sz.fontNota}px; font-weight: bold; text-transform: uppercase;
    letter-spacing: 1px; border-bottom: 1px solid #000;
    padding-bottom: 2px; margin: 8px 0 4px 0;
  }
  .item   { display: flex; gap: 4px; font-size: ${sz.fontItem}px; font-weight: bold; margin-bottom: 2px; line-height: 1.3; }
  .qty    { min-width: ${sz.qtyWidth}px; font-size: ${sz.fontItem}px; }
  .name   { flex: 1; word-break: break-word; }
  .nota   { font-size: ${sz.fontNota}px; margin: 0 0 5px ${sz.qtyWidth + 2}px; font-style: italic; color: #333; }
  .footer { font-size: ${sz.fontFooter}px; text-align: center; color: #555; margin-top: 6px; }
  @media print {
    @page { margin: 0; size: ${sz.pageSize}; }
    body  { width: ${sz.width}; max-width: ${sz.width}; }
  }
</style>
</head>
<body>
  ${empresaNombre ? `<div class="center rest-name">${escHtml(empresaNombre)}</div><div style="height:2px"></div>` : ''}
  <div class="titulo-ticket">✦ ${titulo} ✦</div>

  <div style="margin: 5px 0;">
    <div class="meta-row"><span class="mesa-num">Mesa ${escHtml(String(mesa.numero))}${mesa.nombre ? ` — ${escHtml(mesa.nombre)}` : ''}</span></div>
    <div class="meta-row">Comanda #${escHtml(String(comanda.numero_comanda || '—'))}</div>
    <div class="meta-row">${comanda.personas || 1} persona${(comanda.personas || 1) !== 1 ? 's' : ''} &nbsp;·&nbsp; ${fechaFmt} ${horaFmt}</div>
  </div>

  <div class="divider"></div>

  <div style="margin: 4px 0;">
    ${areasHTML}
  </div>

  <div class="divider"></div>

  ${nombreMesero ? `<div class="footer">Mesero/a: ${escHtml(nombreMesero)}</div>` : ''}
  <div class="footer">— Ksmart360 —</div>
</body>
</html>`;

  _printInIframe(html);
}

/**
 * Imprime la cuenta (ticket de cobro) para que el cliente la lleve a la caja.
 *
 * @param {string} [opts.printerSize] - 'p80' | 'p58' (default 'p80')
 */
export function imprimirCuenta({
  mesa,
  comanda,
  items,
  empresaNombre = '',
  nombreMesero  = '',
  propina       = 0,
  printerSize   = 'p80',
}) {
  if (!items || items.length === 0) return;

  const sz = PRINTER_SIZES[printerSize] ?? PRINTER_SIZES.p80;

  const ahora    = new Date();
  const horaFmt  = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const fechaFmt = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const fmtCOP = (v) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v ?? 0);

  const subtotal = items.reduce((s, i) => s + (i.subtotal ?? i.cantidad * i.precio_unitario), 0);
  const total    = subtotal + (propina || 0);

  const itemsHTML = items.map(item => `
    <div class="item-row">
      <span class="item-qty">${item.cantidad}×</span>
      <span class="item-name">${escHtml(item.nombre_producto)}</span>
      <span class="item-price">${fmtCOP(item.subtotal ?? item.cantidad * item.precio_unitario)}</span>
    </div>
    ${item.notas ? `<div class="nota">↳ ${escHtml(item.notas)}</div>` : ''}
  `).join('');

  const fontTotSub  = Math.round(sz.fontBase * 0.92);
  const fontTotMain = Math.round(sz.fontBase * 1.15);
  const ticketNumF  = Math.round(sz.fontMesa * 0.9);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Cuenta</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: ${sz.fontBase}px;
    width: ${sz.width};
    max-width: ${sz.width};
    padding: ${sz.margin} 3mm;
    color: #000;
    background: #fff;
  }
  .center       { text-align: center; }
  .rest-name    { font-size: ${sz.fontMesa}px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
  .divider      { border-top: ${sz.dividerPx}px solid #000; margin: 5px 0; }
  .titulo-ticket {
    font-size: ${sz.fontTitulo}px; font-weight: bold; text-align: center;
    letter-spacing: 3px; padding: 3px 0;
    border-top: ${sz.dividerPx}px solid #000; border-bottom: ${sz.dividerPx}px solid #000;
    margin: 4px 0;
  }
  .meta-row     { font-size: ${sz.fontMeta}px; margin-bottom: 3px; }
  .mesa-num     { font-size: ${sz.fontMesa}px; font-weight: bold; }
  .ticket-num   {
    font-size: ${ticketNumF}px; font-weight: bold; text-align: center;
    border: ${sz.dividerPx}px solid #000; padding: 5px 0;
    margin: 5px 0; letter-spacing: 2px;
  }
  .item-row     { display: flex; gap: 4px; font-size: ${sz.fontBase}px; margin-bottom: 2px; line-height: 1.3; }
  .item-qty     { min-width: ${sz.qtyWidth}px; }
  .item-name    { flex: 1; word-break: break-word; }
  .item-price   { text-align: right; min-width: ${sz.printerSize === 'p58' ? 60 : 72}px; }
  .nota         { font-size: ${sz.fontNota}px; margin: 0 0 4px ${sz.qtyWidth + 2}px; font-style: italic; color: #333; }
  .totals-row   { display: flex; justify-content: space-between; margin-top: 3px; }
  .totals-sub   { font-size: ${fontTotSub}px; }
  .totals-main  { font-size: ${fontTotMain}px; font-weight: bold; border-top: 1px solid #000; padding-top: 3px; margin-top: 3px; }
  .footer       { font-size: ${sz.fontFooter}px; text-align: center; color: #555; margin-top: 5px; }
  @media print {
    @page { margin: 0; size: ${sz.pageSize}; }
    body  { width: ${sz.width}; max-width: ${sz.width}; }
  }
</style>
</head>
<body>
  ${empresaNombre ? `<div class="center rest-name">${escHtml(empresaNombre)}</div><div style="height:2px"></div>` : ''}
  <div class="titulo-ticket">✦ CUENTA ✦</div>

  <div style="margin: 5px 0;">
    <div class="meta-row"><span class="mesa-num">Mesa ${escHtml(String(mesa.numero))}${mesa.nombre ? ` — ${escHtml(mesa.nombre)}` : ''}</span></div>
    <div class="meta-row">${comanda.personas || 1} persona${(comanda.personas || 1) !== 1 ? 's' : ''} &nbsp;·&nbsp; ${fechaFmt} ${horaFmt}</div>
    ${nombreMesero ? `<div class="meta-row">Atendido por: ${escHtml(nombreMesero)}</div>` : ''}
  </div>

  <div class="ticket-num">TICKET N° ${escHtml(String(comanda.numero_comanda || '—'))}</div>

  <div class="divider"></div>

  <div style="margin: 4px 0;">
    ${itemsHTML}
  </div>

  <div class="divider"></div>

  ${propina > 0 ? `
    <div class="totals-row totals-sub"><span>Subtotal</span><span>${fmtCOP(subtotal)}</span></div>
    <div class="totals-row totals-sub"><span>Propina sugerida</span><span>${fmtCOP(propina)}</span></div>
  ` : ''}
  <div class="totals-row totals-main"><span>TOTAL</span><span>${fmtCOP(total)}</span></div>

  <div style="height:6px"></div>
  <div class="footer">Presente este ticket en la caja</div>
  <div class="footer">— Ksmart360 —</div>
</body>
</html>`;

  _printInIframe(html);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _printInIframe(html) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.warn('printComanda: error al imprimir', e);
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 3000);
  }, 350);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
