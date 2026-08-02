import { sunmiDisponible, imprimirRecibo, padLR } from './sunmiPrinter';

const PRINTER_SIZES = {
  p80: { width: '80mm', font: '10px', fontSm: '8px', fontLg: '16px' },
  p58: { width: '58mm', font: '9px',  fontSm: '7px', fontLg: '13px' },
};

// ─── Impresión en Sunmi (líneas estructuradas) ────────────────────────────────
function buildLavaderoLines(orden, config) {
  const nombre = config?.nombre_lavadero || 'Lavadero';
  const fechaSalida = orden.fecha_salida ? new Date(orden.fecha_salida) : new Date();
  const fechaStr = fechaSalida.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaStr  = fechaSalida.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const lines = [];
  lines.push({ text: nombre, align: 'center', size: 28, bold: true });
  lines.push({ type: 'divider' });
  lines.push({ text: 'RECIBO DE LAVADO', align: 'center', size: 24, bold: true });
  lines.push({ type: 'divider' });
  lines.push({ text: orden.placa, align: 'center', size: 34, bold: true });
  if (orden.tipo_vehiculo) lines.push({ text: orden.tipo_vehiculo, align: 'center', size: 20 });
  lines.push({ type: 'divider' });
  if (orden.cliente_nombre) lines.push({ text: padLR('Cliente', orden.cliente_nombre), size: 22 });
  if (orden.operador_nombre) lines.push({ text: padLR('Lavador', orden.operador_nombre), size: 22 });
  lines.push({ text: padLR('Fecha', fechaStr), size: 22 });
  lines.push({ text: padLR('Hora', horaStr), size: 22 });
  lines.push({ type: 'divider' });
  lines.push({ text: 'SERVICIOS:', size: 22, bold: true });
  (orden.detalles || []).forEach(d => {
    const nom = `${d.nombre_servicio}${d.cantidad > 1 ? ` x${d.cantidad}` : ''}`;
    lines.push({ text: padLR(nom, `$${_fmt(d.precio_unitario * d.cantidad)}`), size: 22 });
  });
  lines.push({ type: 'divider' });
  lines.push({ text: padLR('TOTAL', `$${_fmt(orden.total)}`), size: 28, bold: true });
  lines.push({ text: padLR('Metodo pago', orden.metodo_pago || '—'), size: 22 });
  if (orden.observaciones) {
    lines.push({ type: 'divider' });
    lines.push({ text: `Obs: ${orden.observaciones}`, size: 20 });
  }
  lines.push({ type: 'divider' });
  lines.push({ text: '¡Gracias por su preferencia!', align: 'center', size: 22, bold: true });
  lines.push({ type: 'feed' });
  return lines;
}

function _printInIframe(html) {
  const win = window.open('about:blank', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    const doPrint = () => { try { win.focus(); win.print(); } catch (e) {} };
    if (win.document.readyState === 'complete') {
      setTimeout(doPrint, 250);
    } else {
      win.onload = () => setTimeout(doPrint, 100);
      setTimeout(doPrint, 600);
    }
    return;
  }
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

export async function imprimirReciboLavadero(orden, config, printerSize = 'p80') {
  // En el dispositivo Sunmi imprimimos en la térmica integrada.
  if (await sunmiDisponible()) {
    try {
      await imprimirRecibo(buildLavaderoLines(orden, config));
      return;
    } catch (e) {
      console.warn('imprimirReciboLavadero: falló Sunmi, se usa HTML', e);
    }
  }

  const sz = PRINTER_SIZES[printerSize] || PRINTER_SIZES.p80;
  const nombre = config?.nombre_lavadero || 'Lavadero';

  const fechaSalida = orden.fecha_salida ? new Date(orden.fecha_salida) : new Date();
  const fechaStr = fechaSalida.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaStr  = fechaSalida.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const serviciosHtml = (orden.detalles || []).map(d =>
    `<div class="row"><span>${d.nombre_servicio}${d.cantidad > 1 ? ` x${d.cantidad}` : ''}</span><span>$${_fmt(d.precio_unitario * d.cantidad)}</span></div>`
  ).join('');

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
<p class="c b" style="font-size:${sz.fontLg};">${nombre}</p>
<div class="sep"></div>
<p class="c b">RECIBO DE LAVADO</p>
<div class="sep"></div>
<div class="placa">${orden.placa}</div>
${orden.tipo_vehiculo ? `<p class="c" style="font-size:${sz.fontSm};">${orden.tipo_vehiculo}</p>` : ''}
<div class="sep"></div>
${orden.cliente_nombre ? `<div class="row"><span>Cliente:</span><span>${orden.cliente_nombre}</span></div>` : ''}
${orden.operador_nombre ? `<div class="row"><span>Lavador:</span><span>${orden.operador_nombre}</span></div>` : ''}
<div class="row"><span>Fecha:</span><span>${fechaStr}</span></div>
<div class="row"><span>Hora:</span><span>${horaStr}</span></div>
<div class="sep"></div>
<p class="b">SERVICIOS:</p>
${serviciosHtml}
<div class="sep"></div>
<div class="row b"><span>TOTAL:</span><span>$${_fmt(orden.total)}</span></div>
<div class="row"><span>Método pago:</span><span>${orden.metodo_pago || '—'}</span></div>
${orden.observaciones ? `<div class="sep"></div><p style="font-size:${sz.fontSm};">Obs: ${orden.observaciones}</p>` : ''}
<div class="sep"></div>
<p class="c b">¡Gracias por su preferencia!</p>
</body></html>`;

  _printInIframe(html);
}
