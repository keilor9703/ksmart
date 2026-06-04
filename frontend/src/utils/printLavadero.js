const PRINTER_SIZES = {
  p80: { width: '80mm', font: '10px', fontSm: '8px', fontLg: '16px' },
  p58: { width: '58mm', font: '9px',  fontSm: '7px', fontLg: '13px' },
};

function _printInIframe(html) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1500);
  }, 350);
}

function _fmt(n) {
  return n != null ? Number(n).toLocaleString('es-CO') : '0';
}

export function imprimirReciboLavadero(orden, config, printerSize = 'p80') {
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
