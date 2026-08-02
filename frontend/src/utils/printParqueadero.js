import { sunmiDisponible, imprimirRecibo, padLR } from './sunmiPrinter';

const PRINTER_SIZES = {
  p80: { width: '80mm', font: '10px', fontSm: '8px', fontLg: '16px' },
  p58: { width: '58mm', font: '9px',  fontSm: '7px', fontLg: '13px' },
};

// ─── Impresión en Sunmi (líneas estructuradas) ────────────────────────────────
function buildEntradaLines(acceso, config, qrDataUrl = null) {
  const parq = config?.nombre_parqueadero || 'Parqueadero';
  const fechaEntrada = acceso.fecha_entrada ? new Date(acceso.fecha_entrada) : new Date();
  const fechaStr = fechaEntrada.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaStr = fechaEntrada.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const lines = [];
  lines.push({ text: parq, align: 'center', size: 28, bold: true });
  if (config?.direccion) lines.push({ text: config.direccion, align: 'center', size: 20 });
  if (config?.horario_apertura) lines.push({ text: `Horario: ${config.horario_apertura} - ${config.horario_cierre || ''}`, align: 'center', size: 20 });
  lines.push({ type: 'divider' });
  lines.push({ text: 'COMPROBANTE DE ENTRADA', align: 'center', size: 24, bold: true });
  lines.push({ type: 'divider' });
  lines.push({ text: acceso.placa, align: 'center', size: 34, bold: true });
  // QR para búsqueda rápida en la salida (se imprime como imagen en la térmica).
  if (qrDataUrl) {
    lines.push({ type: 'image', bitmap: qrDataUrl, maxWidth: 300 });
    lines.push({ text: 'Escanear para busqueda rapida', align: 'center', size: 18 });
  }
  lines.push({ type: 'divider' });
  if (acceso.nombre_ocasional) lines.push({ text: padLR('Cliente', acceso.nombre_ocasional), size: 22 });
  if (acceso.telefono) lines.push({ text: padLR('Tel', acceso.telefono), size: 22 });
  lines.push({ text: padLR('Fecha entrada', fechaStr), size: 22 });
  lines.push({ text: padLR('Hora entrada', horaStr), size: 22 });
  if (config?.tarifa_minuto > 0) lines.push({ text: padLR('Tarifa', `$${_fmt(config.tarifa_minuto)}/min`), size: 22 });
  if (config?.cobro_minimo_minutos > 0) lines.push({ text: padLR('Minimo cobro', `${config.cobro_minimo_minutos} min`), size: 22 });
  lines.push({ type: 'divider' });
  lines.push({ text: 'Conserve este comprobante', align: 'center', size: 20 });
  lines.push({ text: '¡Gracias por su visita!', align: 'center', size: 22, bold: true });
  lines.push({ type: 'feed' });
  return lines;
}

function buildSalidaLines(acceso, minutos, monto, metodoPago, config) {
  const parq = config?.nombre_parqueadero || 'Parqueadero';
  const ahora = new Date();
  const fechaStr = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaStr = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  const tiempoStr = horas > 0 ? `${horas}h ${mins}min` : `${minutos} min`;
  const lines = [];
  lines.push({ text: parq, align: 'center', size: 28, bold: true });
  if (config?.direccion) lines.push({ text: config.direccion, align: 'center', size: 20 });
  lines.push({ type: 'divider' });
  lines.push({ text: 'COMPROBANTE DE SALIDA', align: 'center', size: 24, bold: true });
  lines.push({ type: 'divider' });
  lines.push({ text: acceso.placa, align: 'center', size: 34, bold: true });
  lines.push({ type: 'divider' });
  if (acceso.nombre_ocasional) lines.push({ text: padLR('Cliente', acceso.nombre_ocasional), size: 22 });
  lines.push({ text: padLR('Fecha', fechaStr), size: 22 });
  lines.push({ text: padLR('Hora salida', horaStr), size: 22 });
  lines.push({ type: 'divider' });
  lines.push({ text: padLR('Tiempo total', tiempoStr), size: 22 });
  if (config?.tarifa_minuto > 0) lines.push({ text: padLR('Tarifa', `$${_fmt(config.tarifa_minuto)}/min`), size: 22 });
  lines.push({ text: padLR('Metodo de pago', metodoPago), size: 22 });
  lines.push({ type: 'divider' });
  lines.push({ text: 'TOTAL PAGADO', align: 'center', size: 22, bold: true });
  lines.push({ text: `$${_fmt(monto)}`, align: 'center', size: 34, bold: true });
  lines.push({ type: 'divider' });
  lines.push({ text: '¡Gracias por su visita!', align: 'center', size: 22, bold: true });
  lines.push({ text: 'Vuelva pronto', align: 'center', size: 20 });
  lines.push({ type: 'feed' });
  return lines;
}

function _printInIframe(html) {
  // Open in a new tab so mobile browsers save the receipt, not the main page.
  const win = window.open('about:blank', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Some browsers fire onload; others need a timeout — handle both.
    const doPrint = () => { try { win.focus(); win.print(); } catch (e) {} };
    if (win.document.readyState === 'complete') {
      setTimeout(doPrint, 250);
    } else {
      win.onload = () => setTimeout(doPrint, 100);
      setTimeout(doPrint, 600); // safety fallback
    }
    return;
  }
  // Popup blocked — fall back to hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 400);
}

function _fmt(n) {
  return n != null ? Number(n).toLocaleString('es-CO') : '0';
}

export async function imprimirEntradaParqueadero(acceso, config, printerSize = 'p80', qrDataUrl = null) {
  // En el dispositivo Sunmi imprimimos en la térmica integrada (con QR como imagen).
  if (await sunmiDisponible()) {
    try {
      await imprimirRecibo(buildEntradaLines(acceso, config, qrDataUrl));
      return;
    } catch (e) {
      console.warn('imprimirEntradaParqueadero: falló Sunmi, se usa HTML', e);
    }
  }

  const sz = PRINTER_SIZES[printerSize] || PRINTER_SIZES.p80;
  const parq = config?.nombre_parqueadero || 'Parqueadero';
  const dir = config?.direccion || '';

  const fechaEntrada = acceso.fecha_entrada ? new Date(acceso.fecha_entrada) : new Date();
  const fechaStr = fechaEntrada.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaStr = fechaEntrada.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const qrBlock = qrDataUrl
    ? `<div style="text-align:center;margin:6px 0;">
         <img src="${qrDataUrl}" style="width:90px;height:90px;" />
       </div>
       <p style="text-align:center;font-size:${sz.fontSm};margin:2px 0 6px;">Escanear para búsqueda rápida</p>`
    : '';

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
  @page { width: ${sz.width}; margin: 4mm 3mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: ${sz.font}; width: ${sz.width}; margin: 0; padding: 0; color: #000; }
  .c { text-align: center; }
  .b { font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .placa { font-size: ${sz.fontLg}; font-weight: 900; letter-spacing: 3px; text-align: center; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 1px 0; }
  p { margin: 2px 0; }
</style>
</head><body>
<p class="c b" style="font-size:${sz.fontLg};">${parq}</p>
${dir ? `<p class="c" style="font-size:${sz.fontSm};">${dir}</p>` : ''}
${config?.horario_apertura ? `<p class="c" style="font-size:${sz.fontSm};">Horario: ${config.horario_apertura} - ${config.horario_cierre || ''}</p>` : ''}
<div class="sep"></div>
<p class="c b">COMPROBANTE DE ENTRADA</p>
<div class="sep"></div>
<div class="placa">${acceso.placa}</div>
${qrBlock}
<div class="sep"></div>
${acceso.nombre_ocasional ? `<div class="row"><span>Cliente:</span><span>${acceso.nombre_ocasional}</span></div>` : ''}
${acceso.telefono ? `<div class="row"><span>Tel:</span><span>${acceso.telefono}</span></div>` : ''}
<div class="row"><span>Fecha entrada:</span><span>${fechaStr}</span></div>
<div class="row"><span>Hora entrada:</span><span>${horaStr}</span></div>
${config?.tarifa_minuto > 0 ? `<div class="row"><span>Tarifa:</span><span>$${_fmt(config.tarifa_minuto)}/min</span></div>` : ''}
${config?.cobro_minimo_minutos > 0 ? `<div class="row"><span>Mínimo cobro:</span><span>${config.cobro_minimo_minutos} min</span></div>` : ''}
<div class="sep"></div>
<p class="c" style="font-size:${sz.fontSm};">Conserve este comprobante</p>
<p class="c b">¡Gracias por su visita!</p>
</body></html>`;

  _printInIframe(html);
}

export async function imprimirSalidaParqueadero(acceso, minutos, monto, metodoPago, config, printerSize = 'p80') {
  // En el dispositivo Sunmi imprimimos en la térmica integrada.
  if (await sunmiDisponible()) {
    try {
      await imprimirRecibo(buildSalidaLines(acceso, minutos, monto, metodoPago, config));
      return;
    } catch (e) {
      console.warn('imprimirSalidaParqueadero: falló Sunmi, se usa HTML', e);
    }
  }

  const sz = PRINTER_SIZES[printerSize] || PRINTER_SIZES.p80;
  const parq = config?.nombre_parqueadero || 'Parqueadero';
  const dir = config?.direccion || '';
  const ahora = new Date();
  const fechaStr = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaStr = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  const tiempoStr = horas > 0 ? `${horas}h ${mins}min` : `${minutos} min`;

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
  @page { width: ${sz.width}; margin: 4mm 3mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: ${sz.font}; width: ${sz.width}; margin: 0; padding: 0; color: #000; }
  .c { text-align: center; }
  .b { font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .placa { font-size: ${sz.fontLg}; font-weight: 900; letter-spacing: 3px; text-align: center; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 1px 0; }
  .total-box { text-align: center; margin: 6px 0; padding: 4px; border: 2px solid #000; }
  .total-num { font-size: ${sz.fontLg}; font-weight: 900; }
  p { margin: 2px 0; }
</style>
</head><body>
<p class="c b" style="font-size:${sz.fontLg};">${parq}</p>
${dir ? `<p class="c" style="font-size:${sz.fontSm};">${dir}</p>` : ''}
<div class="sep"></div>
<p class="c b">COMPROBANTE DE SALIDA</p>
<div class="sep"></div>
<div class="placa">${acceso.placa}</div>
<div class="sep"></div>
${acceso.nombre_ocasional ? `<div class="row"><span>Cliente:</span><span>${acceso.nombre_ocasional}</span></div>` : ''}
<div class="row"><span>Fecha:</span><span>${fechaStr}</span></div>
<div class="row"><span>Hora salida:</span><span>${horaStr}</span></div>
<div class="sep"></div>
<div class="row"><span>Tiempo total:</span><span>${tiempoStr}</span></div>
${config?.tarifa_minuto > 0 ? `<div class="row"><span>Tarifa:</span><span>$${_fmt(config.tarifa_minuto)}/min</span></div>` : ''}
<div class="row"><span>Método de pago:</span><span>${metodoPago}</span></div>
<div class="sep"></div>
<div class="total-box">
  <p class="b">TOTAL PAGADO</p>
  <div class="total-num">$${_fmt(monto)}</div>
</div>
<div class="sep"></div>
<p class="c b">¡Gracias por su visita!</p>
<p class="c" style="font-size:${sz.fontSm};">Vuelva pronto</p>
</body></html>`;

  _printInIframe(html);
}
