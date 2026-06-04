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

export function imprimirEntradaParqueadero(acceso, config, printerSize = 'p80', qrDataUrl = null) {
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

export function imprimirSalidaParqueadero(acceso, minutos, monto, metodoPago, config, printerSize = 'p80') {
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
