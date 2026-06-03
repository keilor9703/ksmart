/**
 * Genera e imprime un ticket de comanda para impresora térmica (80mm).
 * Usa un iframe oculto para no interrumpir la UI del mesero.
 *
 * @param {object} opts
 * @param {object} opts.mesa           - { numero, nombre, zona }
 * @param {object} opts.comanda        - { numero_comanda, personas }
 * @param {Array}  opts.items          - [{ nombre_producto, cantidad, notas, area_cocina }]
 * @param {string} [opts.empresaNombre]
 * @param {string} [opts.nombreMesero]
 * @param {string} [opts.titulo]       - 'COMANDA' | 'REIMPRESIÓN' etc.
 */
export function imprimirComanda({
  mesa,
  comanda,
  items,
  empresaNombre = '',
  nombreMesero  = '',
  titulo        = 'COMANDA',
}) {
  if (!items || items.length === 0) return;

  const ahora   = new Date();
  const horaFmt = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
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
    font-size: 13px;
    width: 80mm;
    max-width: 80mm;
    padding: 4mm 3mm;
    color: #000;
    background: #fff;
  }
  .center  { text-align: center; }
  .rest-name { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
  .divider { border-top: 2px solid #000; margin: 5px 0; }
  .sep-dashed { border-top: 1px dashed #555; margin: 6px 0; }
  .titulo-ticket {
    font-size: 15px; font-weight: bold; text-align: center;
    letter-spacing: 3px; padding: 3px 0;
    border-top: 2px solid #000; border-bottom: 2px solid #000;
    margin: 4px 0;
  }
  .meta-row  { font-size: 12px; margin-bottom: 3px; }
  .mesa-num  { font-size: 20px; font-weight: bold; }
  .area-header {
    font-size: 11px; font-weight: bold; text-transform: uppercase;
    letter-spacing: 1px; border-bottom: 1px solid #000;
    padding-bottom: 2px; margin: 8px 0 4px 0;
  }
  .item { display: flex; gap: 4px; font-size: 15px; font-weight: bold; margin-bottom: 2px; line-height: 1.3; }
  .qty  { min-width: 24px; font-size: 15px; }
  .name { flex: 1; word-break: break-word; }
  .nota { font-size: 11px; margin: 0 0 5px 22px; font-style: italic; color: #333; }
  .footer { font-size: 11px; text-align: center; color: #555; margin-top: 6px; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body  { width: 80mm; max-width: 80mm; }
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

  // ── Inyectar en iframe oculto y disparar print ──────────────────────────────
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Pequeño delay para que el iframe renderice antes de llamar print()
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.warn('printComanda: error al imprimir', e);
    }
    // Limpiar el iframe después de que el diálogo se haya abierto
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 3000);
  }, 350);
}

/**
 * Imprime la cuenta (ticket de cobro) para que el cliente la lleve a la caja.
 * Muestra precios, total y el número de comanda como identificador.
 */
export function imprimirCuenta({
  mesa,
  comanda,
  items,
  empresaNombre = '',
  nombreMesero  = '',
  propina       = 0,
}) {
  if (!items || items.length === 0) return;

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

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Cuenta</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    width: 80mm;
    max-width: 80mm;
    padding: 4mm 3mm;
    color: #000;
    background: #fff;
  }
  .center      { text-align: center; }
  .rest-name   { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
  .divider     { border-top: 2px solid #000; margin: 5px 0; }
  .titulo-ticket {
    font-size: 15px; font-weight: bold; text-align: center;
    letter-spacing: 3px; padding: 3px 0;
    border-top: 2px solid #000; border-bottom: 2px solid #000;
    margin: 4px 0;
  }
  .meta-row    { font-size: 12px; margin-bottom: 3px; }
  .mesa-num    { font-size: 20px; font-weight: bold; }
  .ticket-num  { font-size: 18px; font-weight: bold; text-align: center; border: 2px solid #000; padding: 5px 0; margin: 5px 0; letter-spacing: 2px; }
  .item-row    { display: flex; gap: 4px; font-size: 13px; margin-bottom: 2px; line-height: 1.3; }
  .item-qty    { min-width: 24px; }
  .item-name   { flex: 1; word-break: break-word; }
  .item-price  { text-align: right; min-width: 72px; }
  .nota        { font-size: 11px; margin: 0 0 4px 24px; font-style: italic; color: #333; }
  .totals-row  { display: flex; justify-content: space-between; margin-top: 3px; }
  .totals-sub  { font-size: 12px; }
  .totals-main { font-size: 15px; font-weight: bold; border-top: 1px solid #000; padding-top: 3px; margin-top: 3px; }
  .footer      { font-size: 11px; text-align: center; color: #555; margin-top: 5px; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body  { width: 80mm; max-width: 80mm; }
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
      console.warn('imprimirCuenta: error al imprimir', e);
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
